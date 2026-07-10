import { dashboard, folder, home, notifications, settings } from '@equinor/eds-icons'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ActionListPanel } from './ActionListPanel'
import { ActionListItem } from './ActionListItem'

const MockLink = ({ to, children, ...rest }: React.ComponentProps<'a'> & { to: string }) => (
  <a href={to} onClick={(e) => e.preventDefault()} {...rest}>
    {children}
  </a>
)

const meta = {
  title: 'Call to actions/ActionList',
  component: ActionListPanel,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 520 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    icon: dashboard,
    title: 'Quick Actions',
    description: '3 items',
    variant: 'accent',
    children: (
      <>
        <ActionListItem
          icon={home}
          title="Overview"
          description="View the main dashboard and project summary."
          linkTo="/overview"
          LinkComponent={MockLink}
        />
        <ActionListItem
          icon={folder}
          title="Reports"
          description="Access generated reports and analytics data."
          linkTo="/reports"
          LinkComponent={MockLink}
        />
        <ActionListItem
          icon={notifications}
          title="Notifications"
          description="Manage notification preferences and view alerts."
          linkTo="/notifications"
          LinkComponent={MockLink}
        />
      </>
    ),
  },
  argTypes: {
    icon: { control: false },
    title: {
      description: 'Panel header title.',
      control: 'text',
    },
    description: {
      description: 'Optional secondary text shown in the panel header.',
      control: 'text',
    },
    variant: {
      description: 'Color theme for the header icon.',
      control: 'select',
      options: ['accent', 'success', 'info', 'warning', 'danger', 'neutral'],
    },
    children: { control: false },
  },
} satisfies Meta<typeof ActionListPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SuccessVariant: Story = {
  args: {
    icon: settings,
    title: 'Configuration',
    description: '2 items',
    variant: 'success',
    children: (
      <>
        <ActionListItem
          icon={settings}
          title="General Settings"
          description="Manage application-wide configuration."
          linkTo="/settings/general"
          variant="success"
          LinkComponent={MockLink}
        />
        <ActionListItem
          icon={folder}
          title="Data Sources"
          description="Configure external data connections."
          linkTo="/settings/data"
          variant="success"
          LinkComponent={MockLink}
        />
      </>
    ),
  },
}

export const WithLockedItems: Story = {
  args: {
    icon: dashboard,
    title: 'Resources',
    variant: 'info',
    children: (
      <>
        <ActionListItem
          icon={home}
          title="Public Resource"
          description="Available to all users."
          linkTo="/resources/public"
          variant="info"
          LinkComponent={MockLink}
        />
        <ActionListItem
          icon={folder}
          title="Restricted Resource"
          description="Requires elevated permissions to access."
          linkTo="/resources/restricted"
          variant="info"
          locked
          lockedReason="Admin only"
        />
      </>
    ),
  },
}
