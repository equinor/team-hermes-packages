import { useUrlPagination } from '../useUrlPagination/useUrlPagination'
import { useQueryState } from 'nuqs'

/** Reset both paging mechanisms in the same nuqs batch as a search edit. */
export function useFinderPagination() {
  const paginationState = useUrlPagination({ defaultPageSize: 100 })
  const [cursor, setCursor] = useQueryState('cursor', { history: 'push', defaultValue: '' })

  const resetPage = (): void => {
    paginationState.resetPage()
    void setCursor(null)
  }

  return { ...paginationState, cursor, setCursor, resetPage }
}
