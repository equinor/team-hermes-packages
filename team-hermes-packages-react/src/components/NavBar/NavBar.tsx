import { NavigationMenu } from '@base-ui/react/navigation-menu'
import { Button, Icon } from '@equinor/eds-core-react'
import { NavListItem } from './components/NavListItem'
import { chevron_down, light, lightbulb } from '@equinor/eds-icons'
import { useColorScheme } from '@/hooks'
import { navbar } from './NavBar.styles'
import { SupportSection } from './components/SupportSection'
import { UserPopover } from './components/UserPopover'
import type { NavBarProps } from './NavBar.types'
import { Chip } from '../Chip/Chip'

export function NavBar(props: NavBarProps) {
  const { categories, LinkComponent, applicationConfig, showColorSchemeToggle = true, environment } = props
  const { colorScheme, toggleColorScheme } = useColorScheme()
  const groupPath = location.pathname.split('/')[1] // Get the first segment of the path

  const navbarStyles = navbar()

  return (
    <NavigationMenu.Root className={navbarStyles.root()} data-testid="navbar">
      <div className="flex items-center gap-4">
        {props.applicationIcon && <span>{props.applicationIcon}</span>}
        <LinkComponent to="/">
          <span className="text-lg font-semibold tracking-wide">{props.applicationConfig?.name}</span>
        </LinkComponent>
        {environment && <Chip fontSize="xs">{environment}</Chip>}
      </div>
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
        {showColorSchemeToggle && (
          <Button variant="ghost_icon" onClick={toggleColorScheme}>
            <Icon
              className={colorScheme === 'light' ? '' : 'rotate-180'}
              data={colorScheme === 'light' ? lightbulb : light}
              size={18}
            />
          </Button>
        )}
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
