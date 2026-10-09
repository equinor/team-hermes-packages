import type { Meta, StoryObj } from '@storybook/react-vite'
import { AccessPermissionsPanel } from './AccessPermissionsPanel'
import type { AccessRole } from './AccessPermissionsPanel.types'

const MockLink = ({ to, children, ...rest }: React.ComponentProps<'a'> & { to: string }) => (
  <a href={to} onClick={(e) => e.preventDefault()} {...rest}>
    {children}
  </a>
)

const roles: AccessRole[] = [
  { value: 'regularuser', label: 'Regular User' },
  { value: 'datareviewer', label: 'Data Reviewer' },
  { value: 'admin', label: 'Admin' },
  { value: 'datamanager', label: 'Data Manager' },
]

const meta: Meta<typeof AccessPermissionsPanel> = {
  title: 'Feature Components/AccessPermissionsPanel',
  component: AccessPermissionsPanel,
  args: {
    roles,
    userRoles: ['regularuser', 'datareviewer'],
    helpHref: '/help/access-and-roles',
    LinkComponent: MockLink,
  },
  argTypes: {
    roles: { control: false },
    userRoles: { control: 'check', options: roles.map((role) => role.value) },
    LinkComponent: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoAccess: Story = {
  args: { userRoles: [] },
}

export const FullAccess: Story = {
  args: { userRoles: roles.map((role) => role.value) },
}

export const ShowHelpLinkWithAccess: Story = {
  args: { showHelpLink: true },
}

export const Loading: Story = {
  args: { isLoading: true },
}
