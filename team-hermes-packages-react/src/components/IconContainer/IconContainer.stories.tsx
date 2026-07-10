import { save, settings, warning_outlined } from '@equinor/eds-icons'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { IconContainer } from './IconContainer'

const meta = {
  title: 'UI/IconContainer',
  component: IconContainer,
  args: {
    icon: save,
  },
  argTypes: {
    icon: {
      description: 'EDS icon to display inside the container.',
      control: false,
    },
    text: {
      description: 'Text or number displayed alongside or instead of the icon.',
      control: 'text',
    },
    iconSize: {
      description: 'Size of the icon in pixels.',
      control: 'select',
      options: [16, 18, 24, 32, 48],
      table: {
        defaultValue: { summary: '18' },
      },
    },
    size: {
      description:
        'Width and height of the container in pixels. Doubles in width when both icon and text are present.',
      control: 'number',
      table: {
        defaultValue: { summary: '48' },
      },
    },
    shape: {
      description: 'Shape of the container.',
      control: 'select',
      options: ['rounded', 'circle'],
      table: {
        defaultValue: { summary: 'rounded' },
      },
    },
    variant: {
      description: 'Color theme for the container background and foreground.',
      control: 'select',
      options: ['accent', 'success', 'info', 'warning', 'danger', 'neutral'],
      table: {
        defaultValue: { summary: 'accent' },
      },
    },
    loading: {
      description: 'Shows a circular progress indicator instead of the icon/text.',
      control: 'boolean',
    },
    loadingSize: {
      description: 'Size of the loading spinner in pixels.',
      control: 'select',
      options: [16, 24, 32, 48],
      table: {
        defaultValue: { summary: '24' },
      },
    },
  },
} satisfies Meta<typeof IconContainer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <IconContainer icon={save} variant="accent" />
      <IconContainer icon={save} variant="success" />
      <IconContainer icon={save} variant="info" />
      <IconContainer icon={save} variant="warning" />
      <IconContainer icon={save} variant="danger" />
      <IconContainer icon={save} variant="neutral" />
    </div>
  ),
}

export const Shapes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <IconContainer icon={save} shape="rounded" />
      <IconContainer icon={save} shape="circle" />
    </div>
  ),
}

export const WithText: Story = {
  args: {
    icon: undefined,
    text: '42',
  },
}

export const IconAndText: Story = {
  args: {
    icon: warning_outlined,
    text: 3,
    variant: 'warning',
  },
}

export const Loading: Story = {
  args: {
    icon: settings,
    loading: true,
  },
}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <IconContainer icon={save} size={32} iconSize={16} />
      <IconContainer icon={save} size={48} iconSize={18} />
      <IconContainer icon={save} size={64} iconSize={24} />
    </div>
  ),
}
