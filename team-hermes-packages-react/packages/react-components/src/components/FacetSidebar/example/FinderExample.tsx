import { useEffect, useMemo, useState } from 'react'
import { useQueryState } from 'nuqs'
import { useFinderPagination } from '../../../hooks/useFinderPagination/useFinderPagination'
import { useRangeFilters } from '../../../hooks/useRangeFilters/useRangeFilters'
import { useTermFilters } from '../../../hooks/useTermFilters/useTermFilters'
import type { Facet } from '../../../shared/types/facet.types'
import { FacetSidebar } from '../FacetSidebar'
import {
  facetGroup,
  facetUnits,
  fetchFacetCatalog,
  globalFacets,
  pinnedFacets,
  search,
  viewLabels,
  type SearchResponse,
  type View,
} from './mockApi'

const views = Object.keys(viewLabels) as View[]

/** Minimal async state holder. Use TanStack Query, SWR or similar in a real app. */
function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; isFetching: boolean }>({ isFetching: true })
  useEffect(() => {
    let cancelled = false
    setState((previous) => ({ ...previous, isFetching: true }))
    void load().then((data) => {
      if (!cancelled) setState({ data, isFetching: false })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

/**
 * A complete finder page: URL-backed view and filters, one search request per view,
 * a separate facet catalog request for the picker, and a shared FacetSidebar.
 */
export function FinderExample() {
  const [viewParam, setView] = useQueryState('view', { defaultValue: 'wells', history: 'push' })
  const view = (views.includes(viewParam as View) ? viewParam : 'wells') as View

  // 1. Create the URL-backed hooks once. Any filter change resets the page, so no effect is needed.
  const { pagination, setPagination, resetPage } = useFinderPagination()
  const termFiltering = useTermFilters({ onFilterChange: resetPage })
  const rangeFiltering = useRangeFilters({ onFilterChange: resetPage })
  const { termFilters, setTermFilters } = termFiltering
  const { rangeFilters, setRangeFilters } = rangeFiltering

  // 2. Sections to show: the view's pinned facets plus every facet with an active filter.
  const enabledFacets = useMemo(
    () => Array.from(new Set([...pinnedFacets[view], ...Object.keys(termFilters), ...Object.keys(rangeFilters)])),
    [view, termFilters, rangeFilters]
  )

  // 3. The search. The mock API accepts the URL filter shape as is; a real API usually needs a transform
  // first (see "Understand the filter state" in the overview).
  // It returns the result rows for the table and the aggregated facets for the sidebar.
  const results = useAsync<SearchResponse>(
    () =>
      search(view, {
        page: pagination.pageIndex,
        per_page: 20,
        terms: termFilters,
        ranges: rangeFilters,
        aggregate_facets: enabledFacets,
      }),
    [view, termFilters, rangeFilters, enabledFacets, pagination.pageIndex]
  )

  // 4. A slower, separate request for the picker. It never blocks the results.
  const catalog = useAsync<Facet[]>(() => fetchFacetCatalog(view), [view])
  const pickerGroups = useMemo(() => {
    const addable = (catalog.data ?? []).filter((facet) => !enabledFacets.includes(facet.key))
    return ['Site', 'Measurements']
      .map((value) => ({ value, items: addable.filter((facet) => facetGroup(facet) === value) }))
      .filter((group) => group.items.length > 0)
  }, [catalog.data, enabledFacets])

  function changeView(next: View) {
    // Drop filters that do not apply everywhere, then start from the first page.
    setRangeFilters(null)
    setTermFilters((previous) =>
      Object.fromEntries(Object.entries(previous ?? {}).filter(([key]) => globalFacets.includes(key)))
    )
    resetPage()
    void setView(next)
  }

  const columns = results.data?.rows[0] ? Object.keys(results.data.rows[0]) : []
  const total = results.data?.total ?? 0
  const lastPage = Math.max(0, Math.ceil(total / 20) - 1)

  return (
    <div className="grid grid-cols-[22rem_1fr] h-[44rem] w-[72rem] border border-stroke-subtle rounded overflow-hidden">
      <div className="border-r border-stroke-subtle min-h-0">
        <FacetSidebar
          termFiltering={termFiltering}
          rangeFiltering={rangeFiltering}
          facets={results.data?.facets ?? []}
          enabledFacets={enabledFacets}
          pickerGroups={pickerGroups}
          isFetching={results.isFetching}
          pinnedFacets={pinnedFacets[view]}
          facetUnits={facetUnits}
          parseFacetLabel={(key) => key.replaceAll('_', ' ')}
        />
      </div>
      <main className="flex flex-col min-h-0 bg-surface text-primary">
        <div className="flex border-b border-stroke-subtle">
          {views.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => changeView(id)}
              className={`px-4 py-3 cursor-pointer ${id === view ? 'font-semibold border-b-2 border-theme-accent-fg text-theme-accent-fg' : 'text-secondary'}`}
            >
              {viewLabels[id]}
            </button>
          ))}
          <span className="ml-auto px-4 py-3 text-secondary">
            {results.isFetching ? 'Loading…' : `${total} results`}
          </span>
        </div>
        <div className="grow overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface-subtle text-secondary">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-3 py-2 font-semibold">
                    {column.replaceAll('_', ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={results.isFetching ? 'opacity-50' : undefined}>
              {results.data?.rows.map((row, index) => (
                <tr key={index} className="border-t border-stroke-subtle">
                  {columns.map((column) => (
                    <td key={column} className="px-3 py-2">
                      {row[column]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-2 p-2 border-t border-stroke-subtle">
          <button
            type="button"
            disabled={pagination.pageIndex === 0}
            onClick={() => setPagination((previous) => ({ ...previous, pageIndex: previous.pageIndex - 1 }))}
          >
            Previous
          </button>
          <span>
            Page {pagination.pageIndex + 1} of {lastPage + 1}
          </span>
          <button
            type="button"
            disabled={pagination.pageIndex >= lastPage}
            onClick={() => setPagination((previous) => ({ ...previous, pageIndex: previous.pageIndex + 1 }))}
          >
            Next
          </button>
        </div>
      </main>
    </div>
  )
}
