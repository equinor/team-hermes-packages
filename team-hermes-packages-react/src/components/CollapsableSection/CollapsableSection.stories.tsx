import { Accordion } from '@base-ui/react/accordion'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CollapsableSection } from './CollapsableSection'
import { TermFilter } from '../TermFilter/TermFilter'

const meta: Meta<typeof CollapsableSection> = {
  title: 'Facet/Components/CollapsableSection',
  component: CollapsableSection,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Accordion.Root multiple defaultValue={['Data type']} className="flex flex-col gap-2 w-80">
        <Story />
      </Accordion.Root>
    ),
  ],
  args: {
    title: 'Data type',
    children: (
      <TermFilter
        label="Data type"
        buckets={[
          { value: 'Core photo', count: 412 },
          { value: 'Core scan', count: 238 },
        ]}
        selectedValues={[]}
        onToggle={() => {}}
      />
    ),
  },
  argTypes: {
    title: { description: 'Section heading.', control: 'text' },
    value: { description: 'Accordion item value. Defaults to `title`.', control: 'text' },
    chipCount: { description: 'Number shown in a chip; hidden when 0.', control: 'number' },
    statsLabel: { description: 'Stats text shown after the chip.', control: 'text' },
    isActive: { description: 'Highlights the border with the accent color.', control: 'boolean' },
    onRemove: { description: 'Renders a remove button in the header when provided.', control: false },
    children: { control: false },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithChipCount: Story = {
  args: { chipCount: 2, isActive: true },
}

export const WithStatsLabel: Story = {
  args: { statsLabel: '1,234 values' },
}

export const Removable: Story = {
  args: { chipCount: 1, isActive: true, onRemove: () => {} },
}

export const MultipleSections: Story = {
  decorators: [
    () => (
      <Accordion.Root multiple defaultValue={['Data type']} className="flex flex-col gap-2 w-80">
        <CollapsableSection title="Data type" chipCount={1} isActive>
          <TermFilter
            label="Data type"
            buckets={[
              { value: 'Core photo', count: 412 },
              { value: 'Core scan', count: 238 },
            ]}
            selectedValues={['Core scan']}
            onToggle={() => {}}
          />
        </CollapsableSection>
        <CollapsableSection title="Well" statsLabel="52 values">
          <p className="text-sm">Collapsed content</p>
        </CollapsableSection>
      </Accordion.Root>
    ),
  ],
}
