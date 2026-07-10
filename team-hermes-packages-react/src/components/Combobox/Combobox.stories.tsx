import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Combobox, type ComboboxItem } from './Combobox'

const fruitItems: ComboboxItem[] = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
  { label: 'Date', value: 'date' },
  { label: 'Elderberry', value: 'elderberry' },
  { label: 'Fig', value: 'fig' },
  { label: 'Grape', value: 'grape' },
]

const meta = {
  title: 'UI/Combobox',
  component: Combobox,
  args: {
    items: fruitItems,
    placeholder: 'Select a fruit…',
    value: null,
    onChange: () => {},
  },
  argTypes: {
    items: {
      description: 'Array of selectable items with `label` and `value`.',
      control: false,
    },
    value: {
      description:
        'Currently selected item(s). A single `ComboboxItem | null` for single select, or `ComboboxItem[]` for multiple.',
      control: false,
    },
    onChange: {
      description: 'Called when the selection changes.',
    },
    multiple: {
      description: 'Enable multi-select mode with chip display.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    label: {
      description: 'Label displayed above the input.',
      control: 'text',
    },
    placeholder: {
      description: 'Placeholder text shown when no value is selected.',
      control: 'text',
    },
    disabled: {
      description: 'Disables the combobox.',
      control: 'boolean',
    },
    clearable: {
      description: 'Shows a clear button for single-select mode.',
      control: 'boolean',
    },
    error: {
      description: 'Error message displayed below the input.',
      control: 'text',
    },
    fitToTriggerWidth: {
      description: 'When true, the popup width matches the trigger width.',
      control: 'boolean',
    },
    autoFocus: {
      description: 'Opens the popup on mount and focuses the input.',
      control: 'boolean',
    },
    defaultInputValue: {
      description: 'Initial value for the text input.',
      control: 'text',
    },
  },
} satisfies Meta<typeof Combobox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: ({ onChange: _, value: __, multiple: ___, ...args }) => {
    const [value, setValue] = useState<ComboboxItem | null>(null)
    return <Combobox {...args} value={value} onChange={setValue} />
  },
}

export const WithLabel: Story = {
  render: ({ onChange: _, value: __, multiple: ___, ...args }) => {
    const [value, setValue] = useState<ComboboxItem | null>(null)
    return <Combobox {...args} label="Fruit" value={value} onChange={setValue} />
  },
}

export const Clearable: Story = {
  render: ({ onChange: _, value: __, multiple: ___, ...args }) => {
    const [value, setValue] = useState<ComboboxItem | null>(fruitItems[0])
    return <Combobox {...args} clearable value={value} onChange={setValue} />
  },
}

export const WithError: Story = {
  render: ({ onChange: _, value: __, multiple: ___, ...args }) => {
    const [value, setValue] = useState<ComboboxItem | null>(null)
    return <Combobox {...args} label="Fruit" error="Please select a fruit" value={value} onChange={setValue} />
  },
}

export const Disabled: Story = {
  render: ({ onChange: _, value: __, multiple: ___, ...args }) => {
    return <Combobox {...args} disabled value={fruitItems[0]} onChange={() => {}} />
  },
}

export const Multiple: Story = {
  render: ({ onChange: _, value: __, multiple: ___, ...args }) => {
    const [value, setValue] = useState<ComboboxItem[]>([fruitItems[0], fruitItems[2]])
    return <Combobox {...args} multiple label="Select fruits" value={value} onChange={setValue} />
  },
}
