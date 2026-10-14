import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { GroupedFacetPicker, type FacetPickerGroup } from './GroupedFacetPicker'

const groups: FacetPickerGroup[] = [
  {
    value: 'Site',
    items: [
      { key: 'well', kind: 'term', count: 52 },
      { key: 'field', kind: 'term', count: 8 },
      { key: 'depth', kind: 'range', count: 1204 },
    ],
  },
  {
    value: 'Analysis',
    items: [
      { key: 'analysis_type', kind: 'term', count: 14 },
      { key: 'analysis_date', kind: 'range', count: 310 },
    ],
  },
  {
    value: 'Measurements',
    items: [
      { key: 'numeric_measurements.porosity', kind: 'range', count: 640 },
      { key: 'categorical_measurements.formation', kind: 'term', count: 22 },
    ],
  },
]

const meta: Meta<typeof GroupedFacetPicker> = {
  title: 'Facet/Components/GroupedFacetPicker',
  component: GroupedFacetPicker,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
  args: { groups, onSubmit: fn() },
  argTypes: {
    buttonLabel: { description: 'Text on the trigger button.', control: 'text' },
    groups: { description: 'Addable items grouped into categories.', control: 'object' },
    onSubmit: { description: 'Called with the picked items.', control: false },
    parseItemLabel: { description: 'Maps an item to its display label. Defaults to `item.key`.', control: false },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CustomLabelParser: Story = {
  args: { parseItemLabel: (item) => item.key.replace(/^(numeric|categorical)_measurements\./, '') },
}

export const CustomButtonLabel: Story = {
  args: { buttonLabel: 'Add facet' },
}
