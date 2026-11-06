import { dark_mode, home, invert_colors, sun, world } from '@equinor/eds-icons'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { SupportSection } from '@/components/NavBar/components/SupportSection'
import { NavBar } from '@/components/NavBar/NavBar'
import type { NavBarProps } from '@/components/NavBar/NavBar.types'
import { initColorScheme } from '@/hooks'

vi.mock('@/components/NavBar/components/SupportSection', () => ({
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
  // jsdom lacks the Popover API that the EDS Tooltip uses
  Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value: vi.fn() })
  document.documentElement.setAttribute('data-color-scheme', 'light')
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
  document.documentElement.removeAttribute('data-color-scheme')
  document.documentElement.removeAttribute('data-color-scheme-preference')
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

describe('NavBar color scheme popover', () => {
  const openPopover = async (name = 'Color scheme') => {
    fireEvent.click(screen.getByRole('button', { name }))
    return screen.findByRole('dialog', { name })
  }
  const triggerIconPath = (trigger: HTMLElement) => trigger.querySelector('path')?.getAttribute('d')

  it('is shown by default as a single button named "Color scheme" that opens a popover', async () => {
    render(<NavBar {...defaultProps} showColorSchemeToggle={undefined} />)

    const trigger = screen.getByRole('button', { name: 'Color scheme' })
    expect(screen.getAllByRole('button')).toEqual([trigger])
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveTextContent('')
    expect(trigger.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')

    const popover = await openPopover()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(within(popover).getByRole('heading', { name: 'Color scheme' })).toBeInTheDocument()
    expect(within(popover).getByRole('radiogroup', { name: 'Color scheme' })).toBeInTheDocument()
    expect(
      within(popover)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value'))
    ).toEqual(['auto', 'light', 'dark'])
    expect(within(popover).getByRole('radio', { name: 'Auto' })).toHaveAccessibleDescription(
      'Follow system color scheme'
    )
  })

  it('is not rendered when showColorSchemeToggle is false', () => {
    render(<NavBar {...defaultProps} showColorSchemeToggle={false} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each([false, true])(
    'follows OS changes with the control hidden (initially shown: %s)',
    async (initiallyShown) => {
      let dark = false
      const mediaQuery = new EventTarget()
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query === '(prefers-color-scheme: dark)' && dark,
        media: query,
        addEventListener: mediaQuery.addEventListener.bind(mediaQuery),
        removeEventListener: mediaQuery.removeEventListener.bind(mediaQuery),
      }))
      initColorScheme()
      const { rerender } = render(<NavBar {...defaultProps} showColorSchemeToggle={initiallyShown} />)
      rerender(<NavBar {...defaultProps} showColorSchemeToggle={false} />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(document.documentElement).toHaveAttribute('data-color-scheme', 'light')

      for (const systemDark of [true, false]) {
        await act(async () => {
          dark = systemDark
          mediaQuery.dispatchEvent(new Event('change'))
        })

        expect(document.documentElement).toHaveAttribute('data-color-scheme', systemDark ? 'dark' : 'light')
        expect(document.documentElement).toHaveAttribute('data-color-scheme-preference', 'auto')
      }
    }
  )

  it.each([false, true])(
    'syncs cross-tab preferences with the control hidden (initially shown: %s)',
    async (initiallyShown) => {
      initColorScheme()
      const { rerender } = render(<NavBar {...defaultProps} showColorSchemeToggle={initiallyShown} />)
      rerender(<NavBar {...defaultProps} showColorSchemeToggle={false} />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(document.documentElement).toHaveAttribute('data-color-scheme', 'light')

      await act(async () => {
        localStorage.setItem('color-scheme', 'dark')
        window.dispatchEvent(new StorageEvent('storage', { key: 'color-scheme', storageArea: localStorage }))
      })

      expect(document.documentElement).toHaveAttribute('data-color-scheme', 'dark')
      expect(document.documentElement).toHaveAttribute('data-color-scheme-preference', 'dark')

      await act(async () => {
        localStorage.clear()
        window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }))
      })

      expect(document.documentElement).toHaveAttribute('data-color-scheme', 'light')
      expect(document.documentElement).toHaveAttribute('data-color-scheme-preference', 'auto')
    }
  )

  it.each([
    { stored: null, preference: 'auto', icon: invert_colors },
    { stored: 'light', preference: 'light', icon: sun },
    { stored: 'dark', preference: 'dark', icon: dark_mode },
  ])(
    'checks $preference and shows its icon when the stored preference is $stored',
    async ({ stored, preference, icon }) => {
      if (stored) localStorage.setItem('color-scheme', stored)
      render(<NavBar {...defaultProps} showColorSchemeToggle />)

      const trigger = screen.getByRole('button', { name: 'Color scheme' })
      expect(triggerIconPath(trigger)).toBe(icon.svgPathData)

      const popover = await openPopover()
      const checked = within(popover).getByRole('radio', { checked: true })
      expect(checked).toHaveAttribute('value', preference)
    }
  )

  it.each([
    { option: 'Dark', preference: 'dark', scheme: 'dark', icon: dark_mode, initial: 'light' },
    { option: 'Light', preference: 'light', scheme: 'light', icon: sun, initial: 'dark' },
    { option: 'Auto', preference: 'auto', scheme: 'light', icon: invert_colors, initial: 'dark' },
  ])(
    'applies $option immediately and keeps the popover open',
    async ({ option, preference, scheme, icon, initial }) => {
      localStorage.setItem('color-scheme', initial)
      render(<NavBar {...defaultProps} showColorSchemeToggle />)
      const trigger = screen.getByRole('button', { name: 'Color scheme' })
      const popover = await openPopover()

      await act(async () => fireEvent.click(within(popover).getByRole('radio', { name: option })))

      expect(document.documentElement).toHaveAttribute('data-color-scheme', scheme)
      expect(document.documentElement).toHaveAttribute('data-color-scheme-preference', preference)
      expect(localStorage.getItem('color-scheme')).toBe(preference)
      expect(within(popover).getByRole('radio', { name: option })).toBeChecked()
      expect(within(popover).getAllByRole('radio', { checked: true })).toHaveLength(1)
      expect(triggerIconPath(trigger)).toBe(icon.svgPathData)
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
    }
  )

  it('closes with the close button', async () => {
    render(<NavBar {...defaultProps} showColorSchemeToggle />)
    const trigger = screen.getByRole('button', { name: 'Color scheme' })
    const popover = await openPopover()

    fireEvent.click(within(popover).getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
  })

  it('uses the localized title, option labels, and Auto description', async () => {
    render(
      <NavBar
        {...defaultProps}
        showColorSchemeToggle
        colorSchemeToggleLabel="Mørk modus"
        autoColorSchemeToggleLabel="Følg systemets fargevalg"
        colorSchemeOptionLabels={{ auto: 'Automatisk', light: 'Lys', dark: 'Mørk' }}
      />
    )

    expect(screen.queryByRole('button', { name: 'Color scheme' })).not.toBeInTheDocument()
    const popover = await openPopover('Mørk modus')

    expect(within(popover).getByRole('radiogroup', { name: 'Mørk modus' })).toBeInTheDocument()
    expect(within(popover).getByRole('radio', { name: 'Automatisk' })).toHaveAccessibleDescription(
      'Følg systemets fargevalg'
    )
    expect(within(popover).getByRole('radio', { name: 'Lys' })).toBeInTheDocument()
    expect(within(popover).getByRole('radio', { name: 'Mørk' })).toBeInTheDocument()
  })

  it('falls back to the default label for options without a custom label', async () => {
    render(<NavBar {...defaultProps} showColorSchemeToggle colorSchemeOptionLabels={{ dark: 'Mørk' }} />)
    const popover = await openPopover()

    expect(
      within(popover)
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent)
    ).toEqual(['Auto', 'Light', 'Mørk'])
  })

  it('updates the selection and trigger icon before the view transition captures the new view', async () => {
    let afterUpdate: { checked: boolean | undefined; icon: string | null | undefined } | undefined
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (update: () => void) => {
        const finished = Promise.resolve().then(() => {
          update()
          afterUpdate = {
            checked: screen.queryByRole<HTMLInputElement>('radio', { name: 'Dark' })?.checked,
            icon: triggerIconPath(screen.getByRole('button', { name: 'Color scheme' })),
          }
        })
        return { ready: finished, finished }
      },
    })

    try {
      localStorage.setItem('color-scheme', 'light')
      render(<NavBar {...defaultProps} showColorSchemeToggle />)
      const popover = await openPopover()
      await act(async () => fireEvent.click(within(popover).getByRole('radio', { name: 'Dark' })))

      expect(afterUpdate).toEqual({ checked: true, icon: dark_mode.svgPathData })
      expect(document.documentElement).toHaveAttribute('data-color-scheme', 'dark')
    } finally {
      Reflect.deleteProperty(document, 'startViewTransition')
    }
  })

  describe('trigger tooltip', () => {
    // jsdom hides closed [popover] elements and the stubbed showPopover cannot open them
    const findTooltip = () => screen.findByRole('tooltip', { hidden: true })
    const queryTooltip = () => screen.queryByRole('tooltip', { hidden: true })

    it.each([
      { name: 'the default label', props: {}, label: 'Color scheme' },
      { name: 'a custom label', props: { colorSchemeToggleLabel: 'Mørk modus' }, label: 'Mørk modus' },
    ])('shows $name in a tooltip on hover', async ({ props, label }) => {
      render(<NavBar {...defaultProps} showColorSchemeToggle {...props} />)
      const trigger = screen.getByRole('button', { name: label })
      expect(queryTooltip()).not.toBeInTheDocument()

      fireEvent.mouseEnter(trigger)

      expect(await findTooltip()).toHaveTextContent(label)
      expect(trigger).toHaveAccessibleDescription(label)

      fireEvent.mouseLeave(trigger)

      await waitFor(() => expect(queryTooltip()).not.toBeInTheDocument())
    })

    it('shows the tooltip when the trigger receives keyboard focus', async () => {
      render(<NavBar {...defaultProps} showColorSchemeToggle />)
      const trigger = screen.getByRole('button', { name: 'Color scheme' })

      fireEvent.keyDown(document.body, { key: 'Tab' })
      act(() => trigger.focus())

      expect(await findTooltip()).toHaveTextContent('Color scheme')
    })

    it('hides the tooltip while the popover is open', async () => {
      render(<NavBar {...defaultProps} showColorSchemeToggle />)
      const trigger = screen.getByRole('button', { name: 'Color scheme' })
      fireEvent.mouseEnter(trigger)
      await findTooltip()

      await openPopover()

      expect(queryTooltip()).not.toBeInTheDocument()

      fireEvent.mouseLeave(trigger)
      fireEvent.mouseEnter(trigger)
      await act(() => new Promise((resolve) => setTimeout(resolve, 200)))

      expect(queryTooltip()).not.toBeInTheDocument()
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
    })
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

    const toggle = screen.getByRole('button', { name: 'Color scheme' })
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
