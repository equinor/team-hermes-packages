import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { MenuCheckboxList } from './MenuCheckboxList'
import { Button } from '@equinor/eds-core-react'

const columnOptions = [
  { label: 'Name', value: 'name' },
  { label: 'Status', value: 'status' },
  { label: 'Created', value: 'created' },
  { label: 'Modified', value: 'modified' },
  { label: 'Owner', value: 'owner' },
]

const meta = {
  title: 'UI/MenuCheckboxList',
  component: MenuCheckboxList,
  args: {
    options: columnOptions,
    trigger: <Button>Select columns</Button>,
    value: ['name', 'status'],
    onChange: () => {},
  },
  argTypes: {
    options: {
      description:
        'Array of options. Each option has a `label`, `value`, and optional `visible` flag (defaults to `true`).',
      control: false,
    },
    value: {
      description: 'Array of currently selected option values.',
      control: false,
    },
    onChange: {
      description: 'Called with the updated array of selected values.',
    },
    trigger: {
      description: 'The element that opens the menu on click. Used in uncontrolled mode.',
      control: false,
    },
    open: {
      description: 'Controls the open state of the menu. Used in controlled mode.',
      control: false,
    },
    setIsOpen: {
      description: 'Callback to update the open state. Used in controlled mode.',
      control: false,
    },
    testIds: {
      description: 'Object with optional `trigger`, `option`, and `popup` test-id helpers.',
      control: false,
    },
  },
} satisfies Meta<typeof MenuCheckboxList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState<string[]>(['name', 'status'])
    return <MenuCheckboxList {...args} value={value} onChange={setValue} />
  },
}

export const NoneSelected: Story = {
  render: (args) => {
    const [value, setValue] = useState<string[]>([])
    return <MenuCheckboxList {...args} value={value} onChange={setValue} />
  },
}

export const WithHiddenOptions: Story = {
  render: (args) => {
    const options = [
      { label: 'Name', value: 'name' },
      { label: 'Status', value: 'status' },
      { label: 'Hidden column', value: 'hidden', visible: false },
      { label: 'Owner', value: 'owner' },
    ]
    const [value, setValue] = useState<string[]>(['name'])
    return <MenuCheckboxList {...args} options={options} value={value} onChange={setValue} />
  },
}

export const Controlled: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState<string[]>(['name'])
    return (
      <div>
        <button onClick={() => setOpen(!open)}>Toggle menu</button>
        <MenuCheckboxList open={open} setIsOpen={setOpen} options={columnOptions} value={value} onChange={setValue} />
      </div>
    )
  },
}
