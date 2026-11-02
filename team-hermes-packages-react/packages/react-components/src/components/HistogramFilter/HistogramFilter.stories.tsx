import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { HistogramFilter } from './HistogramFilter'
import type { HistogramRangeBounds } from './HistogramFilter.types'

const numberBuckets = [3, 8, 15, 27, 42, 55, 48, 36, 21, 12, 6, 2].map((count, i) => ({ key: 100 + i * 50, count }))
const dateBuckets = [4, 9, 18, 31, 44, 38, 25, 14, 7].map((count, i) => ({ key: `${2000 + i * 3}-01-01`, count }))

const meta: Meta<typeof HistogramFilter> = {
  title: 'Facet/Components/HistogramFilter',
  component: HistogramFilter,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-80 border border-stroke-subtle rounded">
        <Story />
      </div>
    ),
  ],
  args: {
    facetKey: 'Depth',
    bucketType: 'number',
    data: { buckets: numberBuckets, min: 100, max: 650, mean: 342.5 },
    unit: 'm',
    onRangeChange: () => {},
  },
  argTypes: {
    facetKey: { description: 'Attribute identifier returned in `onRangeChange`.', control: 'text' },
    data: { description: 'Histogram buckets with optional min, max and mean.', control: 'object' },
    unit: { description: 'Unit displayed next to labels and inputs.', control: 'text' },
    bucketType: {
      description: 'Whether bucket keys are numbers or ISO dates.',
      control: 'radio',
      options: ['number', 'date'],
    },
    range: { description: 'Currently selected range.', control: 'object' },
    onRangeChange: { description: 'Called when a range is committed.', control: false },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: ({ range: _, onRangeChange: __, ...args }) => {
    const [range, setRange] = useState<HistogramRangeBounds | undefined>()
    return <HistogramFilter {...args} range={range} onRangeChange={setRange} />
  },
}

export const WithSelectedRange: Story = {
  render: ({ range: _, onRangeChange: __, ...args }) => {
    const [range, setRange] = useState<HistogramRangeBounds | undefined>({ from: 200, to: 450 })
    return <HistogramFilter {...args} range={range} onRangeChange={setRange} />
  },
}

export const Dates: Story = {
  render: ({ range: _, onRangeChange: __, ...args }) => {
    const [range, setRange] = useState<HistogramRangeBounds | undefined>()
    return <HistogramFilter {...args} range={range} onRangeChange={setRange} />
  },
  args: {
    facetKey: 'Acquisition date',
    bucketType: 'date',
    unit: undefined,
    data: { buckets: dateBuckets, min: '2000-01-01', max: '2026-06-30' },
  },
}

export const WithoutMean: Story = {
  args: { data: { buckets: numberBuckets } },
}

export const Empty: Story = {
  args: { data: { buckets: [] } },
  parameters: { docs: { description: { story: 'Renders nothing when there are no buckets.' } } },
}
