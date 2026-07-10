import { NavigationMenu } from '@base-ui/react/navigation-menu'
import { Button, Icon } from '@equinor/eds-core-react'
import type { IconData } from '@equinor/eds-icons'
import { type NavLinkType, NavListItem } from './components/NavListItem'
import { chevron_down, light, lightbulb } from '@equinor/eds-icons'
import { useColorScheme } from '@/hooks'
import { navbar } from './NavBar.styles'
import { SupportSection } from './components/SupportSection'
import { UserPopover } from './components/UserPopover'
import type { Theme } from '@/shared/types'

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

type NavBarProps = {
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
  /** Application configuration including name, support links, and role definitions. */
  applicationConfig?: ApplicationConfig
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
}

export function NavBar(props: NavBarProps) {
  const { categories, LinkComponent, applicationConfig } = props
  const { colorScheme, toggleColorScheme } = useColorScheme()
  const groupPath = location.pathname.split('/')[1] // Get the first segment of the path

  const navbarStyles = navbar()

  return (
    <NavigationMenu.Root className={navbarStyles.root()} data-testid="navbar">
      <LinkComponent to="/">
        <span className="text-lg font-semibold tracking-wide">{props.applicationConfig?.name}</span>
      </LinkComponent>
      <NavigationMenu.List className="relative flex gap-8 p-2">
        {categories.map((nav_item) => (
          <NavigationMenu.Item key={nav_item.title}>
            <NavigationMenu.Trigger className={navbarStyles.trigger({ active: groupPath === nav_item.basePath })}>
              <Icon data={nav_item.icon} size={18} color={`var(--color-theme-${nav_item.theme}-fg)`} />
              {nav_item.title}
              <NavigationMenu.Icon className={navbarStyles.chevron()}>
                <Icon data={chevron_down} size={18} />
              </NavigationMenu.Icon>
            </NavigationMenu.Trigger>

            <NavigationMenu.Content className={navbarStyles.content()}>
              <ul className="flex list-none flex-col min-w-90">
                {nav_item.links.map((item) => (
                  <NavListItem key={item.href} item={item} LinkComponent={LinkComponent} />
                ))}
              </ul>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        ))}
      </NavigationMenu.List>
      <div className="flex items-center gap-2">
        <Button variant="ghost_icon" onClick={toggleColorScheme}>
          <Icon
            className={colorScheme === 'light' ? '' : 'rotate-180'}
            data={colorScheme === 'light' ? lightbulb : light}
            size={18}
          />
        </Button>
        {props.user && (
          <UserPopover
            APPLICATION_ROLES_LIST={props.applicationConfig?.roles}
            user={props.user}
            logOut={props.logOut}
          />
        )}
        {(applicationConfig?.githubRepoName || applicationConfig?.serviceNowLink) && (
          <SupportSection applicationConfig={props.applicationConfig} />
        )}
      </div>

      <NavigationMenu.Portal data-testid="navbar-portal">
        <NavigationMenu.Positioner
          sideOffset={10}
          collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
          collisionAvoidance={{ side: 'none' }}
          className="z-10"
        >
          <NavigationMenu.Popup className="popup-animation menu-popup">
            <NavigationMenu.Viewport className="relative h-full w-full overflow-hidden" />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  )
}
