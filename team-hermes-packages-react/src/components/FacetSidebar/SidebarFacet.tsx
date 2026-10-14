import { Progress } from '@equinor/eds-core-react'
import type { Facet } from '../../shared/types/facet.types'
import type { RangeBounds, RangeFilter } from '../../shared/utils/urlFilterCodecs'
import { CollapsableSection } from '../CollapsableSection/CollapsableSection'
import { HistogramFilter } from '../HistogramFilter/HistogramFilter'
import { TermFilter } from '../TermFilter/TermFilter'

export type SidebarFacetProps = {
  /** The enabled key is available even while its facet metadata is loading. */
  facetKey: string
  facet?: Facet
  /** Maps the facet key to its display label. Defaults to the key. */
  parseFacetLabel?: (key: string) => string
  /** Unit label shown next to the range inputs (e.g. "m"). */
  unit?: string
  /** Current range selection for histogram facets. */
  range?: RangeBounds
  /** Called when the user changes the histogram range. */
  onRangeChange: (range: RangeFilter) => void
  /** Currently selected term values. */
  selectedValues?: string[]
  /** Called when the user toggles a term value. */
  onToggle: (value: string) => void
  /** Optional stats label shown in the header (e.g. "1,234 values"). */
  statsLabel?: string
  /** When true, highlights the border with the accent color. */
  isActive?: boolean
  /** When provided, renders a remove (×) button in the header. */
  onRemove?: () => void
  /** Loading state of the query that aggregates the enabled facets. */
  isFetching?: boolean
}

/**
 * A collapsible section rendering the right filter (term list or histogram) for a facet.
 * Must be rendered inside a Base UI `Accordion.Root`.
 */
export function SidebarFacet({
  facetKey,
  facet,
  parseFacetLabel = (key) => key,
  unit,
  range,
  onRangeChange,
  selectedValues,
  onToggle,
  statsLabel,
  isActive,
  onRemove,
  isFetching,
}: SidebarFacetProps) {
  const isEmpty = !facet || (facet.kind === 'term' ? !facet.buckets.length : !facet.histogram?.buckets?.length)
  const label = parseFacetLabel(facetKey)

  return (
    <CollapsableSection
      title={label}
      value={facetKey}
      chipCount={range ? 1 : (selectedValues?.length ?? 0)}
      statsLabel={statsLabel}
      isActive={isActive}
      onRemove={onRemove}
    >
      {isEmpty && (
        <div className="flex items-center justify-center p-6">
          {isFetching && <Progress.Circular />}
          {!isFetching && <span>No filters available</span>}
        </div>
      )}
      {facet?.kind === 'range' && facet.histogram && !isEmpty && (
        <HistogramFilter
          facetKey={facetKey}
          data={facet.histogram}
          unit={unit}
          bucketType={facet.value_type === 'date' ? 'date' : 'number'}
          range={range}
          onRangeChange={onRangeChange}
        />
      )}
      {facet?.kind === 'term' && !isEmpty && (
        <TermFilter label={label} buckets={facet.buckets} selectedValues={selectedValues ?? []} onToggle={onToggle} />
      )}
    </CollapsableSection>
  )
}
