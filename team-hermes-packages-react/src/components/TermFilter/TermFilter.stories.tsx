import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { TermFilter } from './TermFilter'

const fewBuckets = [
  { value: 'Core photo', count: 412 },
  { value: 'Core scan', count: 238 },
  { value: 'Thin section', count: 95 },
]

const manyBuckets = [
  'Core photo',
  'Core scan',
  'Thin section',
  'Plug analysis',
  'Routine core analysis',
  'Special core analysis',
  'Geochemistry',
  'Biostratigraphy',
  'XRD',
  'SEM',
  'Petrography',
  'Core description',
].map((value, i) => ({ value, count: 500 - i * 37 }))

const meta: Meta<typeof TermFilter> = {
  title: 'Facet/Components/TermFilter',
  component: TermFilter,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-72 border border-stroke-subtle rounded p-2">
        <Story />
      </div>
    ),
  ],
  args: {
    label: 'Data type',
    buckets: fewBuckets,
    selectedValues: [],
    onToggle: () => {},
  },
  argTypes: {
    label: { description: 'Facet name used in the search placeholder.', control: 'text' },
    buckets: { description: 'Available terms with result counts.', control: 'object' },
    selectedValues: { description: 'Currently selected values.', control: 'object' },
    onToggle: { description: 'Called with the value when an option is toggled.', control: false },
  },
}

export default meta
type Story = StoryObj<typeof meta>

function useToggle(initial: string[]) {
  const [selected, setSelected] = useState(initial)
  const toggle = (value: string) =>
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  return [selected, toggle] as const
}

export const Default: Story = {
  render: ({ selectedValues, onToggle: _, ...args }) => {
    const [selected, toggle] = useToggle(selectedValues)
    return <TermFilter {...args} selectedValues={selected} onToggle={toggle} />
  },
}

export const WithSelection: Story = {
  render: ({ selectedValues, onToggle: _, ...args }) => {
    const [selected, toggle] = useToggle(selectedValues)
    return <TermFilter {...args} selectedValues={selected} onToggle={toggle} />
  },
  args: { selectedValues: ['Core scan'] },
}

export const ManyTerms: Story = {
  render: ({ selectedValues, onToggle: _, ...args }) => {
    const [selected, toggle] = useToggle(selectedValues)
    return <TermFilter {...args} selectedValues={selected} onToggle={toggle} />
  },
  args: { buckets: manyBuckets, selectedValues: ['XRD'] },
}
