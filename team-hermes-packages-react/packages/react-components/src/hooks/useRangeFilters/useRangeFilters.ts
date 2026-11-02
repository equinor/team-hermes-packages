import { parseRangeFilterString, type RangeFilter, serializeRangeFilters } from '../../shared/utils/urlFilterCodecs'
import { type UseFilterQueryStateOptions, useFilterQueryState } from '../useFilterQueryState/useFilterQueryState'

export function useRangeFilters(options: UseFilterQueryStateOptions = {}) {
  const [rangeFilters, setRangeFilters] = useFilterQueryState(
    'ranges',
    {
      parse: parseRangeFilterString,
      serialize: serializeRangeFilters,
    },
    options
  )

  function addRangeFilters(newFilters: RangeFilter[]) {
    setRangeFilters((previous) => ({
      ...previous,
      ...Object.fromEntries(newFilters.map(({ attribute, ...bounds }) => [attribute, bounds])),
    }))
  }

  function toggleRange(newFilter: RangeFilter) {
    addRangeFilters([newFilter])
  }

  function removeRangeFilter(attribute: string) {
    setRangeFilters((previous) => {
      const next = { ...previous }
      delete next[attribute]
      return next
    })
  }

  return { rangeFilters, setRangeFilters, addRangeFilters, toggleRange, removeRangeFilter }
}

/** The value returned by `useRangeFilters`, for passing the state down to components. */
export type RangeFiltering = ReturnType<typeof useRangeFilters>
