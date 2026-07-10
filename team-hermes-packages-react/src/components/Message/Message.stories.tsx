import { settings } from '@equinor/eds-icons'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Message } from './Message'

const meta = {
  title: 'UI/Message',
  component: Message,
  args: {
    children: 'Use messages to provide contextual feedback or status updates.',
  },
  argTypes: {
    children: {
      description: 'Content displayed inside the message.',
      control: 'text',
    },
    title: {
      description: 'Optional title displayed above the message content.',
      control: 'text',
    },
    type: {
      description: 'Color theme for the message. Uses EDS color appearance tokens.',
      control: 'select',
      options: ['accent', 'success', 'info', 'warning', 'danger', 'neutral'],
      table: {
        defaultValue: { summary: 'info' },
      },
    },
    iconPosition: {
      description: 'Controls whether the icon appears before, after, or is hidden from the message content.',
      control: 'select',
      options: ['start', 'end', 'none'],
      table: {
        defaultValue: { summary: 'start' },
      },
    },
    iconSize: {
      description: 'Size of the message icon.',
      control: 'select',
      options: [16, 18, 24, 32, 48],
      table: {
        defaultValue: { summary: '24' },
      },
    },
    iconOverride: {
      description: 'EDS icon used instead of the default icon for the selected type.',
      control: false,
    },
    onDismiss: {
      description: 'Adds a dismiss button to the message.',
    },
    fullWidth: {
      description: 'Makes the message fill the available width.',
      control: 'boolean',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
    className: {
      description: 'Additional class names applied to the root element.',
      control: false,
    },
  },
} satisfies Meta<typeof Message>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithTitle: Story = {
  args: {
    title: 'Information',
    children: 'The request has been received and is being processed.',
  },
}

export const Types: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '8px' }}>
      <Message type="neutral" title="Neutral">
        General information that does not need extra emphasis.
      </Message>
      <Message type="accent" title="Accent">
        Highlighted information related to the current workflow.
      </Message>
      <Message type="success" title="Success">
        The operation completed successfully.
      </Message>
      <Message type="info" title="Info">
        Additional context is available for this item.
      </Message>
      <Message type="warning" title="Warning">
        Review this before continuing.
      </Message>
      <Message type="danger" title="Danger">
        Something needs attention before the operation can continue.
      </Message>
    </div>
  ),
}

export const Dismissible: Story = {
  args: {
    title: 'Dismissible message',
    children: 'This message can be dismissed.',
    onDismiss: () => {},
  },
}

export const IconAtEnd: Story = {
  args: {
    title: 'Icon at end',
    children: 'The icon can be placed after the message content.',
    iconPosition: 'end',
  },
}

export const WithoutIcon: Story = {
  args: {
    title: 'Without icon',
    children: 'The message can be displayed without an icon.',
    iconPosition: 'none',
  },
}

export const CustomIcon: Story = {
  args: {
    title: 'Custom icon',
    children: 'Use iconOverride when the default type icon is not specific enough.',
    iconOverride: settings,
  },
}

export const FullWidth: Story = {
  args: {
    title: 'Full width',
    children: 'Use fullWidth when the message should span the available container.',
    fullWidth: true,
  },
}
