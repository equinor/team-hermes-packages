import type { Meta, StoryObj } from '@storybook/react-vite'
import { WhatsNewPanel } from './WhatsNewPanel'
import type { Release } from './WhatsNewPanel.types'
import { parseReleaseNotes } from './WhatsNewPanel.utils'

const MockLink = ({ to, children, ...rest }: React.ComponentProps<'a'> & { to: string }) => (
  <a href={to} onClick={(e) => e.preventDefault()} {...rest}>
    {children}
  </a>
)

const today = new Date().toISOString().slice(0, 10)

const releaseNotesMarkdown = `# What's New

## v1.40.0 (${today})

### New Features

- Core Data Finder: Added pre-defined sorting options
- Reports: Added report upload flow including duplication check and review step
- New re-authentication flow for login when the session expires

### Bug Fixes

- Fixed range sliders showing the wrong maximum or precision for depth and date facets
- Fixed thousands separator formatting for numbers

---

## v1.39.1 (2026-07-08)

### Bug Fixes

- Fixed LAS export failing for wells without depth reference
`

const releases = parseReleaseNotes(releaseNotesMarkdown)

const olderReleases: Release[] = [
  {
    version: '1.39.1',
    date: '2026-07-08',
    features: [],
    bugFixes: ['Fixed LAS export failing for wells without depth reference'],
  },
]

const meta: Meta<typeof WhatsNewPanel> = {
  title: 'Feature Components/WhatsNewPanel',
  component: WhatsNewPanel,
  args: {
    appName: 'WellCoreDB',
    releases,
    releaseNotesHref: '/docs/release-notes',
    LinkComponent: MockLink,
    defaultOpen: true,
  },
  argTypes: {
    LinkComponent: { control: false },
    releases: { control: false },
    error: { control: false },
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

export const Collapsed: Story = {
  args: { defaultOpen: false },
}

export const OlderRelease: Story = {
  args: { releases: olderReleases, appName: 'PetroDB' },
}

export const Loading: Story = {
  args: { isLoading: true },
}

export const WithError: Story = {
  args: { error: new Error('Failed to fetch') },
}

export const NoReleases: Story = {
  args: { releases: [] },
}
