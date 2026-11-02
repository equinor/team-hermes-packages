import type { Meta, StoryObj } from '@storybook/react-vite'
import { ScrollArea } from './ScrollArea'

const meta: Meta<typeof ScrollArea> = {
  title: 'UI/ScrollArea',
  component: ScrollArea,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="h-64 w-72 border border-stroke-subtle rounded">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    className: { description: 'Additional classes for the root element.', control: 'text' },
    children: { control: false },
  },
}

export default meta
type Story = StoryObj<typeof meta>

const items = Array.from({ length: 30 }, (_, i) => `Item ${i + 1}`)

export const Default: Story = {
  args: {
    children: items.map((item) => (
      <div key={item} className="px-3 py-2 text-sm">
        {item}
      </div>
    )),
  },
}

export const ShortContent: Story = {
  args: {
    children: <p className="p-3 text-sm">Content that fits does not show a scrollbar.</p>,
  },
}
