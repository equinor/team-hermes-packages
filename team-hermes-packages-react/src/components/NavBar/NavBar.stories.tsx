import { dashboard, home, settings, folder, notifications, category } from '@equinor/eds-icons'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { NavBar } from './NavBar'
import type { NavLinkType } from './components/NavListItem'

const mockLinks: NavLinkType[] = [
  {
    href: '/overview',
    title: 'Overview',
    description: 'View the main dashboard and summary of all projects.',
    icon: home,
  },
  {
    href: '/reports',
    title: 'Reports',
    description: 'Access generated reports and analytics data.',
    icon: folder,
  },
  {
    href: '/notifications',
    title: 'Notifications',
    description: 'Manage notification preferences and view alerts.',
    icon: notifications,
  },
]

const MockLink = ({ to, children, ...rest }: React.ComponentProps<'a'> & { to: string }) => (
  <a href={to} onClick={(e) => e.preventDefault()} {...rest}>
    {children}
  </a>
)

const meta = {
  title: 'Navigation/NavBar',
  component: NavBar,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    categories: [
      {
        title: 'Dashboard',
        basePath: 'dashboard',
        icon: dashboard,
        theme: 'success',
        links: mockLinks,
      },
      {
        title: 'Settings',
        basePath: 'settings',
        icon: settings,
        theme: 'accent',
        links: mockLinks.slice(0, 2),
      },
      {
        title: 'Resources',
        basePath: 'resources',
        icon: category,
        theme: 'info',
        links: mockLinks,
      },
    ],
    LinkComponent: MockLink,
    applicationConfig: {
      name: 'MyApp',
    },
  },
  argTypes: {
    categories: {
      description: 'Array of navigation categories, each with a title, icon, theme, and links.',
      control: false,
    },
    LinkComponent: {
      description: 'A router-aware link component (e.g. from react-router or Next.js).',
      control: false,
    },
    applicationConfig: {
      description: 'Optional application configuration for support links and roles.',
      control: false,
    },
    user: {
      description:
        'Optional user information to display in the user popover. If omitted, the user popover will not be rendered.',
      control: false,
    },
    logOut: {
      description: 'Callback function to log out the user.',
      control: false,
    },
  },
} satisfies Meta<typeof NavBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithUser: Story = {
  args: {
    user: {
      name: 'Ola Nordmann',
      email: 'ola.nordmann@equinor.com',
      roles: ['admin', 'editor'],
    },
    logOut: () => {},
    applicationConfig: {
      name: 'MyApp',
      roles: [
        { value: 'admin', label: 'Admin' },
        { value: 'editor', label: 'Editor' },
        { value: 'viewer', label: 'Viewer' },
      ],
      serviceNowLink: 'https://equinor.service-now.com',
      githubRepoName: 'equinor/team-hermes-packages',
    },
  },
}

export const WithApplicationConfig: Story = {
  args: {
    applicationConfig: {
      name: 'MyApp',
      serviceNowLink: 'https://equinor.service-now.com',
      githubRepoName: 'equinor/team-hermes-packages',
    },
  },
}
