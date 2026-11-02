import type { Column } from '@tanstack/react-table'
import { type ComboboxItem } from '@/components'
import { AttributeType, FilterOperator, type FilterValue } from '@/shared/types'

const SELECT_OPERATORS: ComboboxItem[] = [
  { value: FilterOperator.eq, label: 'Equals' },
  { value: FilterOperator.neq, label: 'Not equals' },
]

const STRING_OPERATORS: ComboboxItem[] = [
  { value: FilterOperator.eq, label: 'Equals' },
  { value: FilterOperator.ilike, label: 'Contains' },
  { value: FilterOperator.neq, label: 'Not equals' },
]

const NUMBER_AND_DATE_OPERATORS: ComboboxItem[] = [
  { value: FilterOperator.eq, label: 'Equals' },
  { value: FilterOperator.neq, label: 'Not equals' },
  { value: FilterOperator.gt, label: 'Greater than' },
  { value: FilterOperator.gte, label: 'Greater than or equal to' },
  { value: FilterOperator.lt, label: 'Less than' },
  { value: FilterOperator.lte, label: 'Less than or equal to' },
]

export function useFilterActions() {
  const getOperatorOptions = <TData extends Record<string, any>>(
    column: Column<TData, unknown> | undefined
  ): ComboboxItem[] => {
    if (!column) return NUMBER_AND_DATE_OPERATORS
    if (column.columnDef.meta?.operatorOptions) return column.columnDef.meta.operatorOptions
    if (column.id === 'site_identifier_source' || column.columnDef.meta?.filterOptions) return SELECT_OPERATORS
    if (column.columnDef.meta?.dataType === AttributeType.TEXT) return STRING_OPERATORS
    return NUMBER_AND_DATE_OPERATORS
  }

  function updateFilterValue(filters: FilterValue, operator: FilterOperator, value: string): FilterValue {
    const filterIndex = filters?.findIndex((f) => f.operator === operator)

    if (filterIndex !== -1 && filterIndex !== undefined && filters) {
      const existing = filters[filterIndex]
      if (existing.properties.includes(value)) return filters
      return filters.map((f, i) => (i === filterIndex ? { ...f, properties: [...f.properties, value] } : f))
    }

    const newFilter = { operator, properties: [value] }
    return filters ? [...filters, newFilter] : [newFilter]
  }

  function removeFilterValue(filters: FilterValue, operator: FilterOperator, value: string): FilterValue {
    return filters
      ?.map((filter) => {
        if (filter.operator === operator) {
          return {
            ...filter,
            properties: filter.properties.filter((prop) => prop !== value),
          }
        }
        return filter
      })
      .filter((filter) => filter.properties.length > 0)
  }

  return {
    getOperatorOptions,
    updateFilterValue,
    removeFilterValue,
  }
}
