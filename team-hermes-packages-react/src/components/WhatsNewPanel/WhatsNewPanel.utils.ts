import type { Release } from './WhatsNewPanel.types'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const VERSION_HEADING = /^## v(\d+\.\d+\.\d+)\s*\((\d{4}-\d{2}-\d{2})\)/

type Section = 'features' | 'bugFixes'

/**
 * Parses a release notes markdown document into structured releases.
 *
 * Expected format:
 * ```md
 * ## v1.2.3 (2026-01-31)
 * ### New Features
 * - Added something
 * ### Bug Fixes
 * - Fixed something
 * ```
 * Releases without any features or bug fixes are dropped.
 */
export function parseReleaseNotes(markdown: string): Release[] {
  const releases: Release[] = []
  let current: Release | null = null
  let section: Section | null = null

  for (const line of markdown.split('\n')) {
    const versionMatch = line.match(VERSION_HEADING)
    if (versionMatch) {
      if (current) releases.push(current)
      current = { version: versionMatch[1], date: versionMatch[2], features: [], bugFixes: [] }
      section = null
      continue
    }

    if (!current) continue

    if (line.startsWith('### New Features')) {
      section = 'features'
      continue
    }
    if (line.startsWith('### Bug Fixes')) {
      section = 'bugFixes'
      continue
    }
    if (line.startsWith('### ') || line.startsWith('## ')) {
      section = null
      continue
    }

    if (section && line.startsWith('- ')) {
      const entry = line.replace(/^-\s*/, '').trim()
      if (entry) current[section].push(entry)
    }
  }

  if (current) releases.push(current)

  return releases.filter((r) => r.features.length > 0 || r.bugFixes.length > 0)
}

export function isRecentRelease(date: string, thresholdDays: number, now: number = Date.now()): boolean {
  const releaseTime = Date.parse(date)
  if (Number.isNaN(releaseTime)) return false
  return (now - releaseTime) / MS_PER_DAY <= thresholdDays
}
