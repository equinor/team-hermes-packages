import type { StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Popover } from './Popover'

const meta = {
  title: 'UI/Popover',
  component: Popover as unknown as React.FC,
  args: {
    trigger: (<button>Open popover</button>) as React.ReactElement,
    children: (
      <div style={{ padding: '1rem', maxWidth: 260 }}>
        <p style={{ margin: 0 }}>This is the popover content.</p>
      </div>
    ),
  },
  argTypes: {
    trigger: {
      description: 'The element that opens the popover on click. Used in uncontrolled mode.',
      control: false,
    },
    children: {
      description: 'Content rendered inside the popover popup.',
      control: false,
    },
    onOpenCallback: {
      description: 'Called when the popover finishes opening.',
    },
    onCloseCallback: {
      description: 'Called when the popover closes.',
    },
    open: {
      description: 'Controls the open state of the popover. Used in controlled mode.',
      control: false,
    },
    setIsOpen: {
      description: 'Callback to update the open state. Used in controlled mode.',
      control: false,
    },
    testIds: {
      description: 'Object with optional `portal` and `popup` test-id strings.',
      control: false,
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithRichContent: Story = {
  args: {
    trigger: <button>Details</button>,
    children: (
      <div style={{ padding: '1rem', maxWidth: 300 }}>
        <h4 style={{ margin: '0 0 0.5rem' }}>Popover heading</h4>
        <p style={{ margin: 0 }}>Popovers can contain any content — text, forms, or other components.</p>
      </div>
    ),
  },
}

export const CustomTriggerClass: Story = {
  args: {
    trigger: <button className="rounded bg-blue-500 text-white px-4 py-2">Styled trigger</button>,
  },
}

export const Controlled: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <div>
        <button onClick={() => setOpen(!open)}>Toggle popover</button>
        <Popover open={open} setIsOpen={setOpen}>
          <div style={{ padding: '1rem', maxWidth: 260 }}>
            <p style={{ margin: 0 }}>This popover is controlled externally.</p>
          </div>
        </Popover>
      </div>
    )
  },
}
