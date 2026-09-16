import type { IconData } from '@equinor/eds-icons'
import type { Theme } from '@/shared/types'

export type NavLinkType = {
  href: string
  title: string
  description: string
  icon: IconData
  variant?: Theme
  /**
   * Optional access predicate. If omitted, the link is always visible.
   * Return `'loading'` to delay rendering until the user data resolves.
   */
  canAccess?: (hasPermission: any) => boolean | 'loading'
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
}

export type NavBarProps = {
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
   * Whether the light/dark mode toggle is shown. Defaults to `true`.
   */
  showColorSchemeToggle?: boolean
}
