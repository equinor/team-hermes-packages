import { useUrlPagination, type UseUrlPaginationOptions } from '../useUrlPagination/useUrlPagination'
import { useQueryState } from 'nuqs'

/**
 * Reset both paging mechanisms in the same nuqs batch as a search edit.
 * Accepts the same options as `useUrlPagination`; `defaultPageSize` defaults to 100.
 */
export function useFinderPagination(options: UseUrlPaginationOptions = {}) {
  const paginationState = useUrlPagination({ defaultPageSize: 100, ...options })
  const [cursor, setCursor] = useQueryState('cursor', { history: 'push', defaultValue: '' })

  const resetPage = (): void => {
    paginationState.resetPage()
    void setCursor(null)
  }

  return { ...paginationState, cursor, setCursor, resetPage }
}
