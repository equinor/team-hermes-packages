import type { Meta, StoryObj } from '@storybook/react-vite'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import type { Facet } from '../../shared/types/facet.types'
import { useRangeFilters } from '../../hooks/useRangeFilters/useRangeFilters'
import { useTermFilters } from '../../hooks/useTermFilters/useTermFilters'
import { FacetSidebar, type FacetSidebarProps } from './FacetSidebar'

const facets: Facet[] = [
  {
    key: 'categorical_measurements.formation',
    kind: 'term',
    source: 'categorical_measurements',
    value_type: 'string',
    count: 120,
    aggregated: true,
    buckets: ['Sandstone', 'Shale', 'Limestone', 'Dolomite'].map((value, i) => ({ value, count: 60 - i * 12 })),
  },
  {
    key: 'numeric_measurements.porosity',
    kind: 'range',
    source: 'numeric_measurements',
    value_type: 'number',
    count: 120,
    aggregated: true,
    histogram: {
      buckets: [2, 8, 20, 34, 25, 12, 5].map((count, i) => ({ key: i * 5, count })),
      min: 0,
      max: 32,
      mean: 14.2,
    },
  },
  {
    key: 'acquisition_date',
    kind: 'range',
    source: null,
    value_type: 'date',
    count: 120,
    aggregated: true,
    histogram: {
      buckets: [5, 12, 30, 40, 18].map((count, i) => ({ key: `${2005 + i * 5}-01-01`, count })),
    },
  },
  {
    key: 'well',
    kind: 'term',
    source: null,
    value_type: 'string',
    count: 120,
    aggregated: true,
    buckets: [{ value: '31/2-1', count: 40 }],
  },
]

const strip = (key: string) => key.replace(/^(numeric|categorical)_measurements\./, '')

/** Creates the filter hooks once, the way a page would, and passes their state down. */
function SidebarWithFilters(props: Omit<FacetSidebarProps, 'termFiltering' | 'rangeFiltering'>) {
  const termFiltering = useTermFilters()
  const rangeFiltering = useRangeFilters()
  return <FacetSidebar {...props} termFiltering={termFiltering} rangeFiltering={rangeFiltering} />
}

const meta: Meta<typeof SidebarWithFilters> = {
  title: 'Facet/Components/FacetSidebar',
  component: SidebarWithFilters,
  parameters: {
    layout: 'centered',
    docs: {
      source: {
        code: `<FacetSidebar
  termFiltering={termFiltering}
  rangeFiltering={rangeFiltering}
  facets={facets}
  enabledFacets={enabledFacets}
  pickerGroups={pickerGroups}
  isFetching={isFetching}
  pinnedFacets={pinnedFacets}
  facetUnits={facetUnits}
  parseFacetLabel={parseFacetLabel}
/>`,
      },
    },
  },
  args: {
    facets,
    enabledFacets: facets.slice(0, 3).map((f) => f.key),
    pickerGroups: [
      { value: 'Site', items: facets.filter((f) => !f.source) },
      { value: 'Measurements', items: facets.filter((f) => f.source) },
    ],
    pinnedFacets: ['acquisition_date'],
    facetUnits: { 'numeric_measurements.porosity': '%' },
    isFetching: false,
  },
  decorators: [
    (Story) => (
      <NuqsTestingAdapter hasMemory>
        <div className="h-[56rem] w-[28rem] border border-stroke-subtle rounded">
          <Story />
        </div>
      </NuqsTestingAdapter>
    ),
  ],
  argTypes: {
    parseFacetLabel: {
      description: 'Maps a facet key to its display label. Defaults to the key.',
      control: false,
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithLabelParser: Story = {
  args: { parseFacetLabel: strip, facetUnits: { porosity: '%' } },
}

export const Loading: Story = {
  args: { facets: [], isFetching: true },
}
