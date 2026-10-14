import { createParser, useQueryState } from 'nuqs'
import { type Dispatch, type SetStateAction, useLayoutEffect, useRef } from 'react'

type FilterCodec<T> = {
  parse: (value: string) => Record<string, T>
  serialize: (filters: Record<string, T>) => string
}

export type UseFilterQueryStateOptions = {
  /** Called after every filter change — use to reset pagination. */
  onFilterChange?: () => void
}

/** Keep keyed filters in the canonical URL parameter without rewriting history on reads. */
export function useFilterQueryState<T>(
  key: 'terms' | 'ranges',
  { parse, serialize }: FilterCodec<T>,
  { onFilterChange }: UseFilterQueryStateOptions = {}
): [Record<string, T>, Dispatch<SetStateAction<Record<string, T> | null>>] {
  const parser = createParser<Record<string, T>>({
    parse,
    serialize,
    eq: (a, b) => serialize(a) === serialize(b),
  }).withDefault({})
  const [filters, setQueryFilters] = useQueryState(key, parser.withOptions({ history: 'push', clearOnDefault: true }))
  // nuqs updates its state ref during React's render; keep same-event edits current in the meantime.
  const pendingFilters = useRef(filters)
  useLayoutEffect(() => {
    pendingFilters.current = filters
  }, [filters])

  const setFilters: Dispatch<SetStateAction<Record<string, T> | null>> = (update) => {
    const next = typeof update === 'function' ? update(pendingFilters.current) : update
    pendingFilters.current = next ?? {}
    void setQueryFilters(next)
    onFilterChange?.()
  }

  return [filters, setFilters]
}
