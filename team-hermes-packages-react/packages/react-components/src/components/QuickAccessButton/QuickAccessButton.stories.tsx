import { dashboard, folder, home, notifications, settings } from '@equinor/eds-icons'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QuickAccessButton } from './QuickAccessButton'

const MockLink = ({ to, children, ...rest }: React.ComponentProps<'a'> & { to: string }) => (
  <a href={to} onClick={(e) => e.preventDefault()} {...rest}>
    {children}
  </a>
)

const meta: Meta<typeof QuickAccessButton> = {
  title: 'Call to actions/QuickAccessButton',
  component: QuickAccessButton,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 240 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    icon: dashboard,
    label: 'Dashboard',
    description: 'View overview',
    linkTo: '/dashboard',
    variant: 'accent',
    LinkComponent: MockLink,
  },
  argTypes: {
    icon: { control: false },
    label: {
      description: 'Primary text displayed below the icon.',
      control: 'text',
    },
    description: {
      description: 'Secondary text below the label.',
      control: 'text',
    },
    linkTo: {
      description: 'Navigation target URL.',
      control: 'text',
    },
    variant: {
      description: 'Color theme for the icon container.',
      control: 'select',
      options: ['accent', 'success', 'info', 'warning', 'danger', 'neutral'],
    },
    locked: {
      description: 'Disables interaction and displays a lock chip.',
      control: 'boolean',
    },
    lockedReason: {
      description: 'Text shown in the lock chip when locked.',
      control: 'text',
    },
    LinkComponent: { control: false },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Variants: Story = {
  decorators: [
    (Story) => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 180px)', gap: 16, justifyContent: 'center' }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <>
      <QuickAccessButton
        icon={home}
        label="Home"
        description="Go to home"
        linkTo="/home"
        variant="accent"
        LinkComponent={MockLink}
      />
      <QuickAccessButton
        icon={folder}
        label="Files"
        description="Browse files"
        linkTo="/files"
        variant="success"
        LinkComponent={MockLink}
      />
      <QuickAccessButton
        icon={settings}
        label="Settings"
        description="App config"
        linkTo="/settings"
        variant="info"
        LinkComponent={MockLink}
      />
      <QuickAccessButton
        icon={notifications}
        label="Alerts"
        description="View alerts"
        linkTo="/alerts"
        variant="warning"
        LinkComponent={MockLink}
      />
      <QuickAccessButton
        icon={dashboard}
        label="Analytics"
        description="View data"
        linkTo="/analytics"
        variant="danger"
        LinkComponent={MockLink}
      />
      <QuickAccessButton
        icon={home}
        label="Archive"
        description="Old items"
        linkTo="/archive"
        variant="neutral"
        LinkComponent={MockLink}
      />
    </>
  ),
}

export const Locked: Story = {
  args: {
    locked: true,
    lockedReason: 'Admin only',
  },
}
