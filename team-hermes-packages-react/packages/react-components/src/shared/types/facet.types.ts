import type { HistogramData } from '../../components/HistogramFilter/HistogramFilter.types'
import type { TermFilterBucket } from '../../components/TermFilter/TermFilter'

/**
 * Facet contract for the facet sidebar.
 *
 * These mirror a typical faceted-search backend response. `value_type` is typed as `string`
 * (rather than a string-literal union) so generated string enums remain assignable.
 */
type FacetBase = {
  key: string
  /** API field value type — 'string' | 'number' | 'date'. */
  value_type: string
  /** Non-null for nested (measurement) facets; null for top-level fields. */
  source: string | null
  count: number | null
  aggregated: boolean
}

export type TermFacet = FacetBase & {
  kind: 'term'
  buckets: TermFilterBucket[]
}

export type RangeFacet = FacetBase & {
  kind: 'range'
  histogram: HistogramData | null
}

export type Facet = TermFacet | RangeFacet
