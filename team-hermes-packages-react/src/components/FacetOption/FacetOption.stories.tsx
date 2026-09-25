import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { FacetOption } from './FacetOption'

const meta: Meta<typeof FacetOption> = {
  title: 'UI/FacetOption',
  component: FacetOption,
  parameters: {
    layout: 'centered',
  },
  args: {
    label: 'Option label',
    checked: false,
    onChange: () => {},
  },
  argTypes: {
    label: {
      description: 'Text label displayed next to the checkbox.',
      control: 'text',
    },
    checked: {
      description: 'Whether the option is currently selected.',
      control: 'boolean',
    },
    count: {
      description: 'Optional result count displayed on the right side.',
      control: 'number',
    },
    dimmed: {
      description: 'Reduces opacity to visually de-emphasise the option.',
      control: 'boolean',
    },
    indented: {
      description: 'Adds extra left padding, useful for nested/hierarchical facets.',
      control: 'boolean',
    },
    onChange: {
      description: 'Called with the new checked state when the user toggles the option.',
      control: false,
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: ({ onChange: _, checked: __, ...args }) => {
    const [checked, setChecked] = useState(false)
    return <FacetOption {...args} checked={checked} onChange={setChecked} />
  },
}

export const Radio: Story = {
  render: ({ onChange: _, checked: __, ...args }) => {
    const [checked, setChecked] = useState(false)
    return <FacetOption {...args} checked={checked} onChange={setChecked} />
  },
  args: {
    type: 'radio',
    count: 32,
  },
}

export const WithCount: Story = {
  render: ({ onChange: _, checked: __, ...args }) => {
    const [checked, setChecked] = useState(false)
    return <FacetOption {...args} checked={checked} onChange={setChecked} />
  },
  args: {
    label: 'Documents',
    count: 1_482,
  },
}

export const Dimmed: Story = {
  render: ({ onChange: _, checked: __, ...args }) => {
    const [checked, setChecked] = useState(false)
    return <FacetOption {...args} checked={checked} onChange={setChecked} />
  },
  args: {
    label: 'Archived',
    count: 0,
    dimmed: true,
  },
}

export const Disabled: Story = {
  render: ({ onChange: _, checked: __, ...args }) => {
    const [checked, setChecked] = useState(false)
    return <FacetOption {...args} checked={checked} onChange={setChecked} />
  },
  args: {
    label: 'Disabled option',
    count: 0,
    disabled: true,
  },
}

export const Indented: Story = {
  render: ({ onChange: _, checked: __, ...args }) => {
    const [checked, setChecked] = useState(false)
    return <FacetOption {...args} checked={checked} onChange={setChecked} />
  },
  args: {
    label: 'Sub-category',
    count: 37,
    indented: true,
  },
}

export const FacetList: Story = {
  render: () => {
    const [selected, setSelected] = useState<Set<string>>(new Set(['pdf']))

    const toggle = (key: string) => (checked: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev)
        if (checked) next.add(key)
        else next.delete(key)
        return next
      })
    }

    return (
      <div>
        <FacetOption label="PDF" count={412} checked={selected.has('pdf')} onChange={toggle('pdf')} />
        <FacetOption label="Word" count={238} checked={selected.has('word')} onChange={toggle('word')} />
        <FacetOption label="Excel" count={95} checked={selected.has('excel')} onChange={toggle('excel')} />
        <FacetOption
          label="Other"
          count={0}
          dimmed
          disabled
          checked={selected.has('other')}
          onChange={toggle('other')}
        />
      </div>
    )
  },
}

export const RadioList: Story = {
  render: () => {
    const [selected, setSelected] = useState<string | null>('pdf')

    const select = (key: string) => (checked: boolean) => {
      if (checked) setSelected(key)
    }

    return (
      <div role="radiogroup">
        <FacetOption type="radio" label="PDF" count={412} checked={selected === 'pdf'} onChange={select('pdf')} />
        <FacetOption type="radio" label="Word" count={238} checked={selected === 'word'} onChange={select('word')} />
        <FacetOption type="radio" label="Excel" count={95} checked={selected === 'excel'} onChange={select('excel')} />
        <FacetOption
          type="radio"
          label="Other"
          count={0}
          dimmed
          disabled
          checked={selected === 'other'}
          onChange={select('other')}
        />
      </div>
    )
  },
}
