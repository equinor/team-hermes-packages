import type { IconData } from '@equinor/eds-icons'
import type { Theme } from '@/shared/types'

export type NavLinkType = {
  href: string
  title: string
  description: string
  icon: IconData
  variant?: Theme
  /**
   * Whether the link is hidden from the navigation menu. For easy conditional rendering based on user permissions or other criteria.
   */
  hidden?: boolean
  /**
   * Whether the link is locked. Locked links are visible but not clickable.
   */
  locked?: boolean
  /**
   * Reason why the link is locked. Displayed as a Chip component.
   */
  lockedReason?: string
  /**
   * Marks the link as external. External links bypass `LinkComponent` and are rendered
   * as a plain anchor that opens in a new tab with an external link icon.
   */
  external?: boolean
}

export type ApplicationConfig = {
  /** The application name displayed in the navbar. */
  name: string
  /** List of application roles used to display permissions in the user popover. */
  roles?: { value: string; label: string }[]
  /** URL to ServiceNow for reporting issues. Shown in the support dialog. */
  serviceNowLink?: string
  /** GitHub repository name (e.g. "equinor/my-repo"). Shown in the support dialog. */
  githubRepoName?: string
  /** Version file URL, defaulting to "/version.txt". Set this for apps hosted under a base path. */
  versionUrl?: string
}

export type NavBarProps = {
  /** Custom left content replacing the application icon, name, and environment label. Null or undefined uses the defaults. */
  leftContent?: React.ReactNode
  /** Custom actions appended after the color scheme, user, and support controls. */
  customActions?: React.ReactNode
  /** Optional icon to display for the application in the navbar. */
  applicationIcon?: React.ReactNode
  /** Application configuration including name, support links, and role definitions. */
  applicationConfig?: ApplicationConfig
  /** Navigation categories, each with a title, base path, icon, theme, and list of links. */
  categories: {
    title: string
    basePath: string
    icon: IconData
    theme: Theme
    links: NavLinkType[]
  }[]
  /** A router-aware link component (e.g. from react-router or Next.js). Must accept a `to` prop. */
  LinkComponent: React.ComponentType<React.ComponentProps<'a'> & { to: string }>
  /** Optional environment label to display in the navbar (e.g., "Development", "Staging", "Production"). */
  environment?: string
  /**
   * Optional user information to display in the user popover. If omitted, the user popover will not be rendered.
   */
  user?: {
    name: string
    email: string
    roles: string[]
  }
  /**
   * Callback function to log out the user. This is required if the `user` prop is provided, as it will be used in the user popover to log out the user.
   */
  logOut?: () => void
  /**
   * Whether the color scheme button is shown. It opens a popover for choosing Auto, Light, or Dark. Defaults to `true`.
   */
  showColorSchemeToggle?: boolean
  /**
   * Accessible name and hover tooltip of the color scheme button, and title of its popover. Defaults to `"Color scheme"`.
   */
  colorSchemeToggleLabel?: string
  /** Description of the Auto option, shown as its tooltip and accessible description. Defaults to `"Follow system color scheme"`. */
  autoColorSchemeToggleLabel?: string
  /** Visible labels of the Auto, Light, and Dark options. Defaults to `"Auto"`, `"Light"`, and `"Dark"`. */
  colorSchemeOptionLabels?: ColorSchemeOptionLabels
}

export type ColorSchemeOptionLabels = {
  auto?: string
  light?: string
  dark?: string
}
