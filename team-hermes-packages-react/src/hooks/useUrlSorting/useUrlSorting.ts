import type { SortingState } from '@tanstack/react-table'
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useMemo } from 'react'

type UseUrlSortingOptions = {
  defaultSortOrder?: 'asc' | 'desc'
  history?: 'push' | 'replace'
  /** Called after the sort state changes — use to reset pagination. */
  onSortChange?: () => void
}

/**
 * URL-backed sorting state for TanStack Table.
 *
 * Stores `sort_by` (column id) and `sort_order` (`'asc'` | `'desc'`) in the
 * URL via nuqs. Supports a single sorted column (TanStack's default).
 */
export function useUrlSorting(options: UseUrlSortingOptions = {}) {
  const { defaultSortOrder = 'asc', history = 'push', onSortChange } = options

  const sortingParams = useMemo(
    () => ({
      sort_by: parseAsString,
      sort_order: parseAsStringLiteral(['asc', 'desc'] as const).withDefault(defaultSortOrder),
    }),
    [defaultSortOrder]
  )

  const [params, setParams] = useQueryStates(sortingParams, { history })

  const sorting = useMemo<SortingState>(
    () => (params.sort_by ? [{ id: params.sort_by, desc: params.sort_order === 'desc' }] : []),
    [params.sort_by, params.sort_order]
  )

  const setSorting: React.Dispatch<React.SetStateAction<SortingState>> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    const column = next[0]
    void setParams({
      sort_by: column?.id ?? null,
      sort_order: column ? (column.desc ? 'desc' : 'asc') : null,
    })
    onSortChange?.()
  }

  return { sorting, setSorting } as const
}
