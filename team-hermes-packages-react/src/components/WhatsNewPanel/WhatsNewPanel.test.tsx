import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vite-plus/test'
import { WhatsNewPanel } from './WhatsNewPanel'
import type { Release } from './WhatsNewPanel.types'
import { isRecentRelease, parseReleaseNotes, toIsoDate } from './WhatsNewPanel.utils'

const MockLink = ({ to, children, ...rest }: React.ComponentProps<'a'> & { to: string }) => (
  <a href={to} {...rest}>
    {children}
  </a>
)

const release: Release = {
  version: '1.2.3',
  date: '2026-01-10',
  features: ['Added export'],
  bugFixes: ['Fixed crash'],
}

const baseProps = {
  appName: 'TestDB',
  releases: [release],
  releaseNotesHref: '/release-notes',
  LinkComponent: MockLink,
  defaultOpen: true,
}

describe('parseReleaseNotes', () => {
  test('parses versions, dates and sections', () => {
    const md = `# What's New

## v1.40.0 (2026-10-01)

### New Features

- Feature A
- Feature B

### Bug Fixes

- Fix A

---

## v1.39.1 (2026-07-08)

### Bug Fixes

- Fix B
`
    expect(parseReleaseNotes(md)).toEqual([
      { version: '1.40.0', date: '2026-10-01', features: ['Feature A', 'Feature B'], bugFixes: ['Fix A'] },
      { version: '1.39.1', date: '2026-07-08', features: [], bugFixes: ['Fix B'] },
    ])
  })

  test('drops releases without entries and ignores unknown sections', () => {
    const md = `## v2.0.0 (2026-01-01)

### Other

- Ignored

## v1.0.0 (2025-12-01)

### New Features

- Kept
`
    expect(parseReleaseNotes(md)).toEqual([{ version: '1.0.0', date: '2025-12-01', features: ['Kept'], bugFixes: [] }])
  })

  test('returns an empty array for empty input', () => {
    expect(parseReleaseNotes('')).toEqual([])
  })

  test('does not attribute sections after a non-version heading to the previous release', () => {
    const md = `## v1.0.0 (2026-01-01)

### New Features

- Real feature

## Upcoming

### New Features

- Not released yet
`
    expect(parseReleaseNotes(md)).toEqual([
      { version: '1.0.0', date: '2026-01-01', features: ['Real feature'], bugFixes: [] },
    ])
  })
})

describe('isRecentRelease', () => {
  // Local time, matching how isRecentRelease interprets YYYY-MM-DD
  const now = new Date(2026, 0, 10, 12).getTime()

  test('is true within the threshold', () => {
    expect(isRecentRelease('2026-01-08', 3, now)).toBe(true)
  })

  test('is true for a release dated today', () => {
    expect(isRecentRelease('2026-01-10', 3, now)).toBe(true)
  })

  test('is false outside the threshold', () => {
    expect(isRecentRelease('2026-01-01', 3, now)).toBe(false)
  })

  test('is false for future-dated releases', () => {
    expect(isRecentRelease('2026-01-12', 3, now)).toBe(false)
  })

  test('is false for invalid dates', () => {
    expect(isRecentRelease('not-a-date', 3, now)).toBe(false)
  })
})

describe('WhatsNewPanel', () => {
  test('renders title with app name and the latest release', () => {
    render(<WhatsNewPanel {...baseProps} />)
    expect(screen.getByText("What's new in TestDB")).toBeInTheDocument()
    expect(screen.getByText('v1.2.3')).toBeInTheDocument()
    expect(screen.getByText('Added export')).toBeInTheDocument()
    expect(screen.getByText('Fixed crash')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See all release notes' })).toHaveAttribute('href', '/release-notes')
  })

  test('shows "New release" chip for a recent release', () => {
    const recent = { ...release, date: toIsoDate(new Date()) }
    render(<WhatsNewPanel {...baseProps} releases={[recent]} />)
    expect(screen.getByText('New release')).toBeInTheDocument()
  })

  test('hides "New release" chip for an old release', () => {
    render(<WhatsNewPanel {...baseProps} />)
    expect(screen.queryByText('New release')).toBeNull()
  })

  test('shows an error message when error is set', () => {
    render(<WhatsNewPanel {...baseProps} error={new Error('boom')} />)
    expect(screen.getByText('Could not load release notes.')).toBeInTheDocument()
    expect(screen.queryByText('v1.2.3')).toBeNull()
  })

  test('shows a progress indicator while loading', () => {
    render(<WhatsNewPanel {...baseProps} isLoading />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByText('v1.2.3')).toBeNull()
  })

  test('shows a fallback when there are no releases', () => {
    render(<WhatsNewPanel {...baseProps} releases={[]} />)
    expect(screen.getByText('No releases yet.')).toBeInTheDocument()
  })

  test('keeps a valid heading hierarchy', () => {
    render(<WhatsNewPanel {...baseProps} />)
    const panelHeading = screen.getByRole('heading', { level: 3 })
    expect(panelHeading).toHaveTextContent("What's new in TestDB")
    expect(panelHeading.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull()
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('2026-01-10')
    expect(screen.getAllByRole('heading', { level: 5 }).map((h) => h.textContent)).toEqual([
      'New Features',
      'Bug Fixes',
    ])
  })
})
