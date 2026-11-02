export type Release = {
  /** Semantic version without the `v` prefix, e.g. `1.40.0`. */
  version: string
  /** ISO date (`YYYY-MM-DD`) the release was published. */
  date: string
  features: string[]
  bugFixes: string[]
}

export type WhatsNewPanelProps = {
  /** Application name shown in the panel title: "What's new in {appName}". */
  appName: string
  /** Releases sorted newest first. Typically the output of `parseReleaseNotes`. */
  releases: Release[]
  /** Route to the full release notes page. */
  releaseNotesHref: string
  /** A router-aware link component (e.g. from react-router or Next.js). Must accept a `to` prop. */
  LinkComponent: React.ComponentType<React.ComponentProps<'a'> & { to: string }>
  /** Shows a spinner instead of the latest release. Defaults to `false`. */
  isLoading?: boolean
  /** Shows an error message instead of the latest release when set. */
  error?: unknown
  /** How many days a release counts as "new" and gets the "New release" chip. Defaults to `3`. */
  newReleaseThresholdDays?: number
  /** Whether the panel starts expanded. Defaults to `false`. */
  defaultOpen?: boolean
}

export type ReleaseCardProps = {
  release: Release
  /**
   * Heading level for the release date. Section headings ("New Features", "Bug Fixes")
   * use the next level down. Defaults to `2`, suitable for a dedicated release notes page.
   */
  headingLevel?: 2 | 3 | 4 | 5
}
