import { parseTermFilterString, serializeTermFilters, type TermFilterEntry } from '../../shared/utils/urlFilterCodecs'
import { type UseFilterQueryStateOptions, useFilterQueryState } from '../useFilterQueryState/useFilterQueryState'

export function useTermFilters(options: UseFilterQueryStateOptions = {}) {
  const [termFilters, setTermFilters] = useFilterQueryState(
    'terms',
    {
      parse: parseTermFilterString,
      serialize: serializeTermFilters,
    },
    options
  )

  function addTermFilters(newFilters: TermFilterEntry[]) {
    setTermFilters((previous) => ({
      ...previous,
      ...Object.fromEntries(newFilters.map(({ attribute, value }) => [attribute, value ?? []])),
    }))
  }

  function toggleTermFilterValue(attribute: string, value: string) {
    setTermFilters((previous) => {
      const values = previous && Object.hasOwn(previous, attribute) ? previous[attribute] : []
      const updated = values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
      return { ...previous, [attribute]: updated }
    })
  }

  function removeTermFilter(attribute: string) {
    setTermFilters((previous) => {
      const next = { ...previous }
      delete next[attribute]
      return next
    })
  }

  return { termFilters, setTermFilters, addTermFilters, toggleTermFilterValue, removeTermFilter }
}

/** The value returned by `useTermFilters`, for passing the state down to components. */
export type TermFiltering = ReturnType<typeof useTermFilters>
