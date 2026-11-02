import { Typography } from '@equinor/eds-core-react'
import { Chip } from '../Chip/Chip'
import type { ReleaseCardProps } from './WhatsNewPanel.types'

type HeadingTag = `h${2 | 3 | 4 | 5 | 6}`

function ReleaseSection({ title, entries, as }: { title: string; entries: string[]; as: HeadingTag }) {
  if (entries.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <Typography variant="h6" as={as}>
        {title}
      </Typography>
      <ul className="list-disc list-inside">
        {entries.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Renders a single release with its date, version and grouped change entries.
 * Used inside `WhatsNewPanel` and suitable for a full release notes page.
 */
export function ReleaseCard({ release, headingLevel = 2 }: ReleaseCardProps) {
  const dateTag: HeadingTag = `h${headingLevel}`
  const sectionTag: HeadingTag = `h${(headingLevel + 1) as 3 | 4 | 5 | 6}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Typography variant="h4" as={dateTag}>
          {release.date}
        </Typography>
        <Chip theme="success">v{release.version}</Chip>
      </div>
      <ReleaseSection title="New Features" entries={release.features} as={sectionTag} />
      <ReleaseSection title="Bug Fixes" entries={release.bugFixes} as={sectionTag} />
    </div>
  )
}
