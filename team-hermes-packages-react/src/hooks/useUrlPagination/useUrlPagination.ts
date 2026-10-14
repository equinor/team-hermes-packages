import type { PaginationState } from '@tanstack/react-table'
import { parseAsInteger, useQueryStates } from 'nuqs'
import { useMemo } from 'react'

export type UseUrlPaginationOptions = {
  defaultPageSize?: number
  defaultPageIndex?: number
  history?: 'push' | 'replace'
  /** Optional prefix for URL param names (e.g. `"w"` → `w_page`, `w_per_page`). */
  prefix?: string
}

/**
 * URL-backed pagination state for TanStack Table.
 *
 * Stores `page` (0-based index) and `per_page` in the URL via nuqs so that
 * pagination survives page reloads and is shareable via the address bar.
 *
 * Returns a TanStack-compatible `pagination` object and `setPagination`
 * dispatcher, plus a `resetPage` helper for callers to invoke when the
 * result set changes (e.g. on filter/sort edits).
 */
export function useUrlPagination(options: UseUrlPaginationOptions = {}) {
  const { defaultPageSize = 25, defaultPageIndex = 0, history = 'push', prefix } = options

  const pageKey = prefix ? `${prefix}_page` : 'page'
  const perPageKey = prefix ? `${prefix}_per_page` : 'per_page'

  const paginationParams = useMemo(
    () => ({
      [pageKey]: parseAsInteger.withDefault(defaultPageIndex),
      [perPageKey]: parseAsInteger.withDefault(defaultPageSize),
    }),
    [defaultPageSize, defaultPageIndex, pageKey, perPageKey]
  )

  const [params, setParams] = useQueryStates(paginationParams, { history })

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: params[pageKey], pageSize: params[perPageKey] }),
    [params[pageKey], params[perPageKey], pageKey, perPageKey]
  )

  const setPagination: React.Dispatch<React.SetStateAction<PaginationState>> = (updater) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater
    void setParams({ [pageKey]: next.pageIndex, [perPageKey]: next.pageSize })
  }

  const resetPage = () => {
    void setParams({ [pageKey]: 0 })
  }

  return { pagination, setPagination, resetPage } as const
}
