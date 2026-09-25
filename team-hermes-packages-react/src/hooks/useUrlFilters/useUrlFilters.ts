import type { ColumnFiltersState, Updater } from '@tanstack/react-table'
import type { FilterOperator, FilterValue } from '@/shared/types'
import { useQueryState } from 'nuqs'
import { useFilters } from '../useFilters/useFilters'

export type UseUrlFiltersOptions = {
  /** Namespaced URL param key: `${prefix}_filters`. Lets multiple grids coexist on one page. */
  prefix?: string
  history?: 'push' | 'replace'
  defaultFilters?: ColumnFiltersState
  /** Called after any filter mutation — use to reset pagination. */
  onFiltersChange?: () => void
}

/**
 * URL-backed filter state for TanStack Table.
 *
 * Stores compound `ColumnFilter` entries (`{ id, value: FilterValue }`) in the URL via nuqs so that
 * facet / chip / popover filter state survives reloads and is shareable via the address bar.
 *
 * Returns TanStack-compatible `filters` + `setFilters` (safe to bind to `state.columnFilters` /
 * `onColumnFiltersChange`), plus per-column helpers so call sites never have to splice
 * the nested `FilterValue` arrays themselves.
 *
 * @example
 * ```tsx
 * const { resetPage } = useUrlPagination()
 * const { filters, setFilters, toggleFilterValue } = useUrlFilters({ onFiltersChange: resetPage })
 *
 * useReactTable({
 *   state: { columnFilters: filters },
 *   onColumnFiltersChange: setFilters,
 *   manualFiltering: true,
 *   // ...
 * })
 *
 * toggleFilterValue('review_status', FilterOperator.eq, 'DRAFT')
 * ```
 */
export const useUrlFilters = (options: UseUrlFiltersOptions = {}) => {
  const { prefix, history = 'push', defaultFilters = [], onFiltersChange } = options
  const { createURIStringFromFiltersObject, createFiltersObjectFromURIString } = useFilters()

  const paramKey = prefix ? `${prefix}_filters` : 'filters'

  const [filters, _setFilters] = useQueryState<ColumnFiltersState>(paramKey, {
    history,
    defaultValue: defaultFilters,
    serialize: createURIStringFromFiltersObject,
    parse: createFiltersObjectFromURIString,
    eq: (a, b) => createURIStringFromFiltersObject(a) === createURIStringFromFiltersObject(b),
    clearOnDefault: true,
  })

  const setFilters = (updater: Updater<ColumnFiltersState>) => {
    const promise = typeof updater === 'function' ? _setFilters((prev) => updater(prev ?? [])) : _setFilters(updater)
    onFiltersChange?.()
    return promise
  }

  /**
   * Reads a column's `FilterValue`, or a specific operator entry within it.
   * Returns `undefined` when the column has no filter (or no entry for the operator).
   */
  const getFilterValue = (columnId: string, operator?: FilterOperator) => {
    const value = filters.find((f) => f.id === columnId)?.value as FilterValue | undefined
    if (!value) return undefined
    if (operator === undefined) return value
    return value.find((f) => f.operator === operator)
  }

  /** `true` when `value` is currently in the column/operator entry. Handy for facet checkbox `checked` props. */
  const hasFilterValue = (columnId: string, operator: FilterOperator, value: unknown): boolean => {
    const entry = getFilterValue(columnId, operator)
    if (!entry || Array.isArray(entry)) return false
    return entry.properties.includes(value)
  }

  /** Appends `value`. Creates the column and operator entry as needed. No-op if the value is already present. */
  const addFilterValue = (columnId: string, operator: FilterOperator, value: unknown) =>
    setFilters((prev) => editColumnFilter(prev, columnId, (fv) => mergeIntoFilterValue(fv, operator, value)))

  /** Removes `value`. Prunes empty operator entries and empty columns. */
  const removeFilterValue = (columnId: string, operator: FilterOperator, value: unknown) =>
    setFilters((prev) => editColumnFilter(prev, columnId, (fv) => dropFromFilterValue(fv, operator, value)))

  /** Adds or removes `value` depending on whether it is currently present. */
  const toggleFilterValue = (columnId: string, operator: FilterOperator, value: unknown) =>
    setFilters((prev) => {
      const already = prev.find((f) => f.id === columnId)?.value as FilterValue | undefined
      const present = already?.find((f) => f.operator === operator)?.properties.includes(value) ?? false
      return editColumnFilter(prev, columnId, (fv) =>
        present ? dropFromFilterValue(fv, operator, value) : mergeIntoFilterValue(fv, operator, value)
      )
    })

  /**
   * Removes `from` and adds `to` in a single URL update. Use when a popover edits an existing entry.
   * `properties` mirrors `FilterValue.properties`, so compound values like `between`'s `[start, end]`
   * are removed / added element-wise.
   */
  const updateFilterValue = (
    columnId: string,
    from: { operator: FilterOperator; properties: unknown[] },
    to: { operator: FilterOperator; properties: unknown[] }
  ) =>
    setFilters((prev) =>
      editColumnFilter(prev, columnId, (fv) => {
        const removed = from.properties.reduce<FilterValue>(
          (acc, value) => dropFromFilterValue(acc, from.operator, value),
          fv
        )
        return to.properties.reduce<FilterValue>(
          (acc, value) => mergeIntoFilterValue(acc, to.operator, value),
          removed
        )
      })
    )

  /** Clears all filters. */
  const resetFilters = () => setFilters([])

  return {
    filters,
    setFilters,
    resetFilters,
    getFilterValue,
    hasFilterValue,
    addFilterValue,
    removeFilterValue,
    updateFilterValue,
    toggleFilterValue,
  }
}

function mergeIntoFilterValue(filterValue: FilterValue, operator: FilterOperator, value: unknown): FilterValue {
  const idx = filterValue.findIndex((f) => f.operator === operator)
  if (idx === -1) return [...filterValue, { operator, properties: [value] }]
  if (filterValue[idx].properties.includes(value)) return filterValue
  return filterValue.map((f, i) => (i === idx ? { ...f, properties: [...f.properties, value] } : f))
}

function dropFromFilterValue(filterValue: FilterValue, operator: FilterOperator, value: unknown): FilterValue {
  return filterValue
    .map((f) => (f.operator === operator ? { ...f, properties: f.properties.filter((p) => p !== value) } : f))
    .filter((f) => f.properties.length > 0)
}

function editColumnFilter(
  filters: ColumnFiltersState,
  columnId: string,
  edit: (fv: FilterValue) => FilterValue
): ColumnFiltersState {
  const idx = filters.findIndex((f) => f.id === columnId)
  const current = idx === -1 ? ([] as FilterValue) : (filters[idx].value as FilterValue)
  const next = edit(current)
  if (next.length === 0) return idx === -1 ? filters : filters.filter((_, i) => i !== idx)
  if (idx === -1) return [...filters, { id: columnId, value: next }]
  return filters.map((f, i) => (i === idx ? { ...f, value: next } : f))
}
