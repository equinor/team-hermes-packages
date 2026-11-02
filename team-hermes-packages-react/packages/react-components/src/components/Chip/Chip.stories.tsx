import { save, settings } from '@equinor/eds-icons'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Chip } from './Chip'

const meta = {
  title: 'UI/Chip',
  component: Chip,
  args: {
    children: 'Chip label',
  },
  argTypes: {
    children: {
      description: 'Content displayed inside the chip.',
      control: 'text',
    },
    theme: {
      description: 'Color theme for the chip. Uses EDS color appearance tokens.',
      control: 'select',
      options: ['accent', 'success', 'info', 'warning', 'danger', 'neutral'],
      table: {
        defaultValue: { summary: 'neutral' },
      },
    },
    fontSize: {
      description: 'Controls the font size and spacing of the chip.',
      control: 'select',
      options: ['xs', 'sm', 'base', 'lg'],
      table: {
        defaultValue: { summary: 'sm' },
      },
    },
    icon: {
      description: 'EDS icon to display before the label.',
      control: false,
    },
    onClick: {
      description: 'Makes the chip content interactive (clickable).',
    },
    onDismiss: {
      description: 'Adds a dismiss button to the chip.',
    },
    chipTooltip: {
      description: 'Tooltip text shown on hover over the chip content.',
      control: 'text',
    },
    dismissTooltip: {
      description: 'Tooltip text shown on hover over the dismiss button.',
      control: 'text',
    },
  },
} satisfies Meta<typeof Chip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Themes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <Chip theme="neutral">Neutral</Chip>
      <Chip theme="accent">Accent</Chip>
      <Chip theme="success">Success</Chip>
      <Chip theme="info">Info</Chip>
      <Chip theme="warning">Warning</Chip>
      <Chip theme="danger">Danger</Chip>
    </div>
  ),
}

export const WithIcon: Story = {
  args: {
    icon: save,
    children: 'Save',
  },
}

export const Interactive: Story = {
  args: {
    onClick: () => {},
    children: 'Click me',
  },
}

export const Dismissible: Story = {
  args: {
    onDismiss: () => {},
    dismissTooltip: 'Remove',
  },
}

export const InteractiveAndDismissible: Story = {
  args: {
    icon: settings,
    onClick: () => {},
    onDismiss: () => {},
    children: 'Settings',
    chipTooltip: 'Open settings',
    dismissTooltip: 'Remove',
  },
}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Chip fontSize="xs">Extra small</Chip>
      <Chip fontSize="sm">Small</Chip>
      <Chip fontSize="base">Base</Chip>
      <Chip fontSize="lg">Large</Chip>
    </div>
  ),
}
