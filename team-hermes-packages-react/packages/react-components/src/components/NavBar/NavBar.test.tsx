import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { home, world } from '@equinor/eds-icons'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { NavBar } from './NavBar'
import type { NavBarProps } from './NavBar.types'
import { SupportSection } from './components/SupportSection'

vi.mock('./components/SupportSection', () => ({
  SupportSection: vi.fn(() => <button type="button">Support</button>),
}))

afterEach(cleanup)

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  document.documentElement.setAttribute('data-color-scheme', 'light')
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-color-scheme')
  localStorage.clear()
})

const defaultProps: NavBarProps = {
  categories: [],
  LinkComponent: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  applicationIcon: <span>Application icon</span>,
  applicationConfig: { name: 'MyApp' },
  environment: 'Development',
  showColorSchemeToggle: false,
}

describe('NavBar navigation', () => {
  it('opens a category and renders internal and external links', async () => {
    render(
      <NavBar
        {...defaultProps}
        LinkComponent={({ to, children, ...rest }) => (
          <a href={to} data-router-link="true" {...rest}>
            {children}
          </a>
        )}
        categories={[
          {
            title: 'Resources',
            basePath: 'resources',
            icon: home,
            theme: 'info',
            links: [
              { href: '/overview', title: 'Overview', description: 'Main dashboard', icon: home },
              {
                href: 'https://www.equinor.com',
                title: 'Equinor',
                description: 'Public website',
                icon: world,
                external: true,
              },
            ],
          },
        ]}
      />
    )

    expect(screen.queryByRole('link', { name: /Overview/ })).not.toBeInTheDocument()
    const categoryTrigger = screen.getByRole('button', { name: 'Resources' })
    fireEvent.click(categoryTrigger)
    expect(categoryTrigger).toHaveAttribute('aria-expanded', 'true')

    const internalLink = (await screen.findByText('Overview')).closest('a')
    expect(internalLink).toHaveAttribute('href', '/overview')
    expect(internalLink).toHaveAttribute('data-router-link', 'true')
    expect(internalLink).not.toHaveAttribute('target')

    const externalLink = screen.getByText('Equinor').closest('a')
    expect(screen.getByText('Opens in a new tab')).toBeInTheDocument()
    expect(externalLink).toHaveAttribute('href', 'https://www.equinor.com')
    expect(externalLink).toHaveAttribute('target', '_blank')
    expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(externalLink).not.toHaveAttribute('data-router-link')

    fireEvent.click(categoryTrigger)
    expect(categoryTrigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('marks only the category matching the first path segment as active', () => {
    const previousUrl = location.pathname + location.search + location.hash
    const previousState = history.state
    history.replaceState(null, '', '/resources/details')

    try {
      render(
        <NavBar
          {...defaultProps}
          categories={[
            { title: 'Resources', basePath: 'resources', icon: home, theme: 'info', links: [] },
            { title: 'Settings', basePath: 'settings', icon: home, theme: 'accent', links: [] },
          ]}
        />
      )

      expect(screen.getByRole('button', { name: 'Resources' })).toHaveClass('after:bg-theme-success-fg')
      expect(screen.getByRole('button', { name: 'Settings' })).not.toHaveClass('after:bg-theme-success-fg')
    } finally {
      history.replaceState(previousState, '', previousUrl)
    }
  })

  it('omits optional branding when no icon, environment, or application config is provided', () => {
    render(
      <NavBar {...defaultProps} applicationIcon={undefined} environment={undefined} applicationConfig={undefined} />
    )

    expect(screen.queryByText('Application icon')).not.toBeInTheDocument()
    expect(screen.queryByText('Development')).not.toBeInTheDocument()
    expect(screen.queryByText('MyApp')).not.toBeInTheDocument()
  })
})

describe('NavBar color scheme toggle', () => {
  it('is shown by default with the accessible name "Dark mode"', () => {
    render(<NavBar {...defaultProps} showColorSchemeToggle={undefined} />)

    expect(screen.getByRole('button', { name: 'Dark mode' })).toBeInTheDocument()
  })

  it('uses colorSchemeToggleLabel as the accessible name', () => {
    render(<NavBar {...defaultProps} showColorSchemeToggle colorSchemeToggleLabel="Mørk modus" />)

    expect(screen.getByRole('button', { name: 'Mørk modus' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dark mode' })).not.toBeInTheDocument()
  })

  it('is not rendered when showColorSchemeToggle is false', () => {
    render(<NavBar {...defaultProps} showColorSchemeToggle={false} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each([
    { colorScheme: 'light', pressed: false },
    { colorScheme: 'dark', pressed: true },
  ])('has aria-pressed=$pressed and a decorative icon in the $colorScheme scheme', ({ colorScheme, pressed }) => {
    document.documentElement.setAttribute('data-color-scheme', colorScheme)
    render(<NavBar {...defaultProps} showColorSchemeToggle />)

    const toggle = screen.getByRole('button', { name: 'Dark mode' })
    expect(toggle).toHaveAttribute('aria-pressed', String(pressed))
    expect(toggle).toHaveTextContent('')
    const icon = toggle.querySelector('svg')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(icon).not.toHaveAttribute('role')
    if (pressed) {
      expect(icon).toHaveClass('rotate-180')
    } else {
      expect(icon).not.toHaveClass('rotate-180')
    }
  })

  it('toggles data-color-scheme, localStorage and aria-pressed when clicked', async () => {
    render(<NavBar {...defaultProps} showColorSchemeToggle />)
    const toggle = screen.getByRole('button', { name: 'Dark mode', pressed: false })

    fireEvent.click(toggle)

    expect(document.documentElement).toHaveAttribute('data-color-scheme', 'dark')
    expect(localStorage.getItem('color-scheme')).toBe('dark')
    expect(await screen.findByRole('button', { name: 'Dark mode', pressed: true })).toBe(toggle)

    fireEvent.click(toggle)

    expect(document.documentElement).toHaveAttribute('data-color-scheme', 'light')
    expect(localStorage.getItem('color-scheme')).toBe('light')
    expect(await screen.findByRole('button', { name: 'Dark mode', pressed: false })).toBe(toggle)
  })

  it('updates aria-pressed and the icon before the view transition captures the new view', async () => {
    let afterUpdate: { pressed: string | null; rotated: boolean | undefined } | undefined
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (update: () => void) => {
        const finished = Promise.resolve().then(() => {
          update()
          const toggle = screen.getByRole('button', { name: 'Dark mode' })
          afterUpdate = {
            pressed: toggle.getAttribute('aria-pressed'),
            rotated: toggle.querySelector('svg')?.classList.contains('rotate-180'),
          }
        })
        return { ready: finished, finished }
      },
    })

    try {
      render(<NavBar {...defaultProps} showColorSchemeToggle />)
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Dark mode' })))

      expect(afterUpdate).toEqual({ pressed: 'true', rotated: true })
      expect(document.documentElement).toHaveAttribute('data-color-scheme', 'dark')
    } finally {
      Reflect.deleteProperty(document, 'startViewTransition')
    }
  })

  it('comes before the user and support controls', () => {
    render(
      <NavBar
        {...defaultProps}
        showColorSchemeToggle
        user={{ name: 'Ola Nordmann', email: 'ola@example.com', roles: [] }}
        applicationConfig={{ name: 'MyApp', githubRepoName: 'equinor/team-hermes-packages' }}
      />
    )

    const toggle = screen.getByRole('button', { name: 'Dark mode' })
    expect(toggle.parentElement?.firstElementChild).toBe(toggle)
    expect(
      toggle.compareDocumentPosition(screen.getByRole('button', { name: 'Toggle user information popover' }))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(toggle.compareDocumentPosition(screen.getByRole('button', { name: 'Support' }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })
})

describe('NavBar user information', () => {
  const user = { name: 'Ola Nordmann', email: 'ola@example.com', roles: ['admin'] }

  it('hides the user control when no user is provided', () => {
    render(<NavBar {...defaultProps} />)

    expect(screen.queryByRole('button', { name: 'Toggle user information popover' })).not.toBeInTheDocument()
  })

  it('shows user details and configured roles, and invokes sign out', async () => {
    const logOut = vi.fn()
    render(
      <NavBar
        {...defaultProps}
        user={user}
        logOut={logOut}
        applicationConfig={{
          name: 'MyApp',
          roles: [
            { value: 'admin', label: 'Administrator' },
            { value: 'viewer', label: 'Viewer' },
          ],
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Toggle user information popover' }))

    expect(await screen.findByText(user.name)).toBeInTheDocument()
    expect(screen.getByText(user.email)).toBeInTheDocument()
    expect(screen.getByText('Administrator')).toBeInTheDocument()
    expect(screen.getByText('Viewer')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(logOut).toHaveBeenCalledOnce()
  })

  it('omits sign out when no callback is provided', async () => {
    render(<NavBar {...defaultProps} user={user} />)

    fireEvent.click(screen.getByRole('button', { name: 'Toggle user information popover' }))

    expect(await screen.findByText(user.name)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })
})

describe('NavBar support visibility', () => {
  it.each([
    { name: 'MyApp', githubRepoName: 'equinor/team-hermes-packages' },
    { name: 'MyApp', serviceNowLink: 'https://equinor.service-now.com' },
    {
      name: 'MyApp',
      githubRepoName: 'equinor/team-hermes-packages',
      serviceNowLink: 'https://equinor.service-now.com',
    },
  ])('shows support and forwards configuration when support links are provided: %j', (applicationConfig) => {
    render(<NavBar {...defaultProps} applicationConfig={applicationConfig} />)

    expect(screen.getByRole('button', { name: 'Support' })).toBeInTheDocument()
    expect(vi.mocked(SupportSection).mock.calls.at(-1)?.[0]).toEqual({ applicationConfig })
  })

  it.each([undefined, { name: 'MyApp' }, { name: 'MyApp', githubRepoName: '', serviceNowLink: '' }])(
    'hides support when no support links are configured: %j',
    (applicationConfig) => {
      render(<NavBar {...defaultProps} applicationConfig={applicationConfig} />)

      expect(screen.queryByRole('button', { name: 'Support' })).not.toBeInTheDocument()
      expect(SupportSection).not.toHaveBeenCalled()
    }
  )
})

describe('NavBar left content', () => {
  it.each([undefined, null])('renders default content when leftContent is %s', (leftContent) => {
    render(<NavBar {...defaultProps} leftContent={leftContent} />)

    expect(screen.getByText('Application icon')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'MyApp' })).toHaveAttribute('href', '/')
    expect(screen.getByText('Development')).toBeInTheDocument()
  })

  it('replaces default content with custom left content', () => {
    render(<NavBar {...defaultProps} leftContent={<a href="/workspace">Workspace</a>} />)

    expect(screen.getByRole('link', { name: 'Workspace' })).toHaveAttribute('href', '/workspace')
    expect(screen.queryByText('Application icon')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'MyApp' })).not.toBeInTheDocument()
    expect(screen.queryByText('Development')).not.toBeInTheDocument()
  })

  it('allows the default content to be hidden with false', () => {
    render(<NavBar {...defaultProps} leftContent={false} />)

    expect(screen.queryByText('Application icon')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'MyApp' })).not.toBeInTheDocument()
    expect(screen.queryByText('Development')).not.toBeInTheDocument()
  })
})

describe('NavBar custom actions', () => {
  it('appends custom content after the existing controls', () => {
    render(
      <NavBar
        {...defaultProps}
        showColorSchemeToggle
        user={{ name: 'Ola Nordmann', email: 'ola@example.com', roles: [] }}
        applicationConfig={{ name: 'MyApp', githubRepoName: 'equinor/team-hermes-packages' }}
        customActions={<button type="button">Custom action</button>}
      />
    )

    const customAction = screen.getByRole('button', { name: 'Custom action' })
    const rightSection = customAction.parentElement!

    expect(rightSection.querySelectorAll('button')).toHaveLength(4)
    expect(rightSection.lastElementChild).toBe(customAction)
    expect(screen.getByRole('link', { name: 'MyApp' })).toBeInTheDocument()
  })

  it('renders custom content when the existing controls are hidden', () => {
    render(<NavBar {...defaultProps} customActions={<button type="button">Custom action</button>} />)

    expect(screen.getAllByRole('button')).toEqual([screen.getByRole('button', { name: 'Custom action' })])
  })

  it.each([undefined, null, false])('keeps existing controls when customActions is %s', (customActions) => {
    render(<NavBar {...defaultProps} showColorSchemeToggle customActions={customActions} />)

    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
