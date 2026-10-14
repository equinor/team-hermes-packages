import { Chip } from '../Chip/Chip'
import type { RangeFiltering } from '../../hooks/useRangeFilters/useRangeFilters'
import type { TermFiltering } from '../../hooks/useTermFilters/useTermFilters'

type ActiveFiltersProps = {
  /** Return value of `useTermFilters`. */
  termFiltering: TermFiltering
  /** Return value of `useRangeFilters`. */
  rangeFiltering: RangeFiltering
  /** Maps a facet key to the label shown in the chip. Defaults to the key. */
  parseFacetLabel?: (key: string) => string
}

/** Chips for every active term and range filter, each removable. Driven by the filter hooks' state passed in as props. */
export function ActiveFilters({ termFiltering, rangeFiltering, parseFacetLabel = (key) => key }: ActiveFiltersProps) {
  const { termFilters, toggleTermFilterValue } = termFiltering
  const { rangeFilters, removeRangeFilter } = rangeFiltering

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {Object.entries(termFilters).map(([attribute, values]) =>
        values.map((value) => (
          <Chip
            fontSize="xs"
            theme="info"
            key={`term-${attribute}-${value}`}
            onDismiss={() => toggleTermFilterValue(attribute, value)}
            dismissTooltip="Remove filter"
          >
            {parseFacetLabel(attribute)} eq {value}
          </Chip>
        ))
      )}
      {Object.entries(rangeFilters).map(([attribute, filter]) => (
        <Chip
          fontSize="xs"
          theme="info"
          key={`range-${attribute}`}
          onDismiss={() => removeRangeFilter(attribute)}
          dismissTooltip="Remove filter"
        >
          {parseFacetLabel(attribute)}: {filter.from} - {filter.to}
        </Chip>
      ))}
    </div>
  )
}
