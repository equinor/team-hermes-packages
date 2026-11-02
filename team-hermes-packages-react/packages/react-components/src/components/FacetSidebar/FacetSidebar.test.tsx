import { fireEvent, render, screen } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { describe, expect, test } from 'vite-plus/test'
import type { Facet } from '../../shared/types/facet.types'
import { useRangeFilters } from '../../hooks/useRangeFilters/useRangeFilters'
import { useTermFilters } from '../../hooks/useTermFilters/useTermFilters'
import { FacetSidebar } from './FacetSidebar'

const facets: Facet[] = [
  {
    key: 'categorical_measurements.formation',
    kind: 'term',
    source: 'categorical_measurements',
    value_type: 'string',
    count: 2,
    aggregated: true,
    buckets: [{ value: 'Sandstone', count: 2 }],
  },
  {
    key: 'numeric_measurements.porosity',
    kind: 'range',
    source: 'numeric_measurements',
    value_type: 'number',
    count: 2,
    aggregated: true,
    histogram: {
      buckets: [
        { key: 0, count: 1 },
        { key: 10, count: 2 },
      ],
    },
  },
]

const strip = (key: string) => key.replace(/^(numeric|categorical)_measurements\./, '')

function Harness({ parseFacetLabel }: { parseFacetLabel?: (key: string) => string }) {
  const termFiltering = useTermFilters()
  const rangeFiltering = useRangeFilters()
  return (
    <FacetSidebar
      termFiltering={termFiltering}
      rangeFiltering={rangeFiltering}
      facets={facets}
      pickerGroups={[{ value: 'Measurements', items: facets }]}
      enabledFacets={facets.map((f) => f.key)}
      pinnedFacets={[facets[0].key]}
      facetUnits={{ porosity: '%' }}
      parseFacetLabel={parseFacetLabel}
    />
  )
}

function renderSidebar(searchParams = '', parseFacetLabel?: (key: string) => string) {
  return render(<Harness parseFacetLabel={parseFacetLabel} />, {
    wrapper: withNuqsTestingAdapter({ searchParams, hasMemory: true }),
  })
}

describe('FacetSidebar', () => {
  test('renders a section per enabled facet using the key as label by default', () => {
    renderSidebar()
    expect(screen.getAllByText('categorical_measurements.formation').length).toBeGreaterThan(0)
    expect(screen.getAllByText('numeric_measurements.porosity').length).toBeGreaterThan(0)
  })

  test('uses parseFacetLabel for headers and unit lookup', () => {
    renderSidebar('', strip)
    expect(screen.getAllByText('formation').length).toBeGreaterThan(0)
    expect(screen.getAllByText('porosity').length).toBeGreaterThan(0)
    expect(screen.queryByText('numeric_measurements.porosity')).not.toBeInTheDocument()
    expect(screen.getAllByText('%').length).toBeGreaterThan(0)
  })

  test('shows parsed labels on active filter chips and resets filters', () => {
    renderSidebar('?terms=categorical_measurements.formation:Sandstone', strip)
    expect(screen.getByText(/formation eq Sandstone/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(screen.queryByText(/formation eq Sandstone/)).not.toBeInTheDocument()
  })

  test('pinned facets are not removable', () => {
    renderSidebar('', strip)
    expect(screen.queryByRole('button', { name: 'Remove formation filter' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove porosity filter' })).toBeInTheDocument()
  })

  test('collapse all toggles to expand all', () => {
    renderSidebar()
    fireEvent.click(screen.getByRole('button', { name: /Collapse all/ }))
    expect(screen.getByRole('button', { name: /Expand all/ })).toBeInTheDocument()
  })
})
