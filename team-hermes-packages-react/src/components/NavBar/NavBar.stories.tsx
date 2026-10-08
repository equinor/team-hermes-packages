import { dashboard, home, settings, folder, notifications, category, library_books, world } from '@equinor/eds-icons'
import { Button, Icon } from '@equinor/eds-core-react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { NavBar } from './NavBar'
import type { NavLinkType } from './NavBar.types'

const testApplicationIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 91 91" fill="none" className="size-full">
    <g clip-path="url(#a)">
      <mask id="b" width="91" height="92" x="0" y="0" maskUnits="userSpaceOnUse">
        <path
          fill="#c4c4c4"
          d="M16.8 91h57.4C83.5 91 91 83.5 91 74.2V16.8C91 7.5 83.5 0 74.2 0H16.8C7.5 0 0 7.5 0 16.8v57.4C0 83.5 7.5 91 16.8 91"
        />
      </mask>
      <g mask="url(#b)">
        <path
          fill="#085883"
          d="M110.7 42.6c41-86-40.2-64.3-86-42.7C-33 23-18.3 57-3 71.9l1.7 2c21 25.4 71.4 53.6 112-31.3"
        />
        <g filter="url(#c)">
          <path
            fill="#0081c2"
            d="M10-22C-45.3 5.6 31 36 68.1 40.6c44.9 7.7 32.2-25.6 26.4-38.8q-.6-1.2-1-2.6C87.8-20 63.8-49 9.9-22"
          />
        </g>
        <g filter="url(#d)">
          <path
            fill="#006aa0"
            d="M88.5 103c51.8-32.4-5.3-45.7-40.4-48.3C4.2 49.3-15 77.2-4 97.2c10.1 18.9 40.5 38.2 92.4 5.8"
          />
        </g>
      </g>
    </g>
    <path
      fill="#fff"
      d="M69.1 47.6q.5 0 .5.5a24 24 0 0 1-9.7 17.7l-.2.2a24 24 0 0 1-4 2.3H34.6a24 24 0 0 1-3.9-2.5 24 24 0 0 1-9.7-17.7q0-.5.4-.5l4-.2q.3 0 .5.4a20 20 0 0 0 10 15.6h18.9a20 20 0 0 0 10-15.6q0-.4.5-.4zM45 34h.6q.8.4 1 1L48.3 47a4.9 4.9 0 1 1-6.1 0l1.7-11.7q0-.9 1-1m13.5-7.7q.2-.3.6-.2a24 24 0 0 1 10.3 17q0 .5-.4.6l-3.9.4a1 1 0 0 1-.5-.4 20 20 0 0 0-8.2-13.5 1 1 0 0 1 0-.7zm-27.2-.2q.3-.1.7.2l2.2 3.2q.1.3-.2.7A20 20 0 0 0 26 43.8q0 .4-.6.4l-3.9-.4a1 1 0 0 1-.4-.5 24 24 0 0 1 10.3-17m14-4.3q5 0 9.9 2.1.3.2.2.6l-1.7 3.6q-.1.3-.6.2a20 20 0 0 0-15.7 0q-.5.1-.7-.2L35 24.7q0-.5.3-.7Q40 22 45.3 22"
    />
    <defs>
      <filter
        id="c"
        width="120"
        height="85.6"
        x="-14.3"
        y="-35.3"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix" />
        <feColorMatrix in="SourceAlpha" result="hardAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
        <feOffset dy="3.6" />
        <feGaussianBlur stdDeviation="2.4" />
        <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.12 0" />
        <feBlend in2="BackgroundImageFix" result="effect1_dropShadow_57_6437" />
        <feColorMatrix in="SourceAlpha" result="hardAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
        <feOffset dy="2.4" />
        <feGaussianBlur stdDeviation="2.4" />
        <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.14 0" />
        <feBlend in2="effect1_dropShadow_57_6437" result="effect2_dropShadow_57_6437" />
        <feBlend in="SourceGraphic" in2="effect2_dropShadow_57_6437" result="shape" />
      </filter>
      <filter
        id="d"
        width="126"
        height="77.3"
        x="-11.8"
        y="51.6"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix" />
        <feColorMatrix in="SourceAlpha" result="hardAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
        <feOffset dy="3.6" />
        <feGaussianBlur stdDeviation="2.4" />
        <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.12 0" />
        <feBlend in2="BackgroundImageFix" result="effect1_dropShadow_57_6437" />
        <feColorMatrix in="SourceAlpha" result="hardAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
        <feOffset dy="2.4" />
        <feGaussianBlur stdDeviation="2.4" />
        <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.14 0" />
        <feBlend in2="effect1_dropShadow_57_6437" result="effect2_dropShadow_57_6437" />
        <feBlend in="SourceGraphic" in2="effect2_dropShadow_57_6437" result="shape" />
      </filter>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h91v91H0z" />
      </clipPath>
    </defs>
  </svg>
)

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

const mockExternalLinks: NavLinkType[] = [
  {
    href: '/overview',
    title: 'Overview',
    description: 'View the main dashboard and summary of all projects.',
    icon: home,
  },
  {
    href: 'https://eds.equinor.com',
    title: 'Design System',
    description: 'Browse the Equinor Design System documentation.',
    icon: library_books,
    external: true,
  },
  {
    href: 'https://www.equinor.com',
    title: 'Equinor.com',
    description: 'Open the public Equinor website.',
    icon: world,
    variant: 'info',
    external: true,
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
    leftContent: {
      description: 'Custom left content replacing the application icon, name, and environment label.',
      control: false,
    },
    customActions: {
      description: 'Custom actions appended after the color scheme, user, and support controls.',
      control: false,
    },
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
    showColorSchemeToggle: {
      description: 'Whether the light/dark mode toggle is shown.',
      control: 'boolean',
    },
  },
} satisfies Meta<typeof NavBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithCustomLeftContent: Story = {
  args: {
    leftContent: (
      <>
        <MockLink to="/">Hermes</MockLink>
        <span className="text-sm">Workspace</span>
      </>
    ),
  },
}

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

export const WithCustomActions: Story = {
  args: {
    ...WithUser.args,
    customActions: (
      <Button as="a" href="/notifications" variant="ghost_icon" aria-label="Notifications" title="Notifications">
        <Icon data={notifications} size={18} />
      </Button>
    ),
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

export const WithoutColorSchemeToggle: Story = {
  args: {
    showColorSchemeToggle: false,
  },
}

export const WithExternalLinks: Story = {
  args: {
    categories: [
      {
        title: 'Resources',
        basePath: 'resources',
        icon: category,
        theme: 'info',
        links: mockExternalLinks,
      },
    ],
  },
}

export const WithEnvironmentAndLogo: Story = {
  args: {
    showColorSchemeToggle: false,
    environment: 'Development',
    applicationIcon: <div className="size-10 flex items-center justify-center">{testApplicationIcon}</div>,
  },
}
