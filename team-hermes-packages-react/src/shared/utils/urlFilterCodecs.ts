export type TermFilters = Record<string, string[]>

export type TermFilterEntry = {
  attribute: string
  value?: string[]
}

export type RangeBounds = {
  from?: number | string | null
  to?: number | string | null
}

export type RangeFilters = Record<string, RangeBounds>
export type RangeFilter = RangeBounds & { attribute: string }

/** Split on the first colon so date bounds can contain time components. */
function filterEntries(value: string): [string, string][] {
  return value.split(',').flatMap((entry) => {
    const separator = entry.indexOf(':')
    return separator > 0 ? [[entry.slice(0, separator), entry.slice(separator + 1)]] : []
  })
}

export function serializeTermFilters(filters: TermFilters): string {
  return Object.entries(filters)
    .map(([attribute, values]) => `${attribute}:${values.join('|')}`)
    .join(',')
}

/** Merge selections for repeated keys without renaming attributes. */
export function parseTermFilterString(value: string): TermFilters {
  const filters = new Map<string, string[]>()
  for (const [attribute, selection] of filterEntries(value)) {
    const values = selection ? selection.split('|') : []
    filters.set(attribute, [...new Set([...(filters.get(attribute) ?? []), ...values])])
  }
  return Object.fromEntries(filters)
}

export function serializeRangeFilters(filters: RangeFilters): string {
  return Object.entries(filters)
    .map(([attribute, range]) => `${attribute}:${range.from ?? ''}~${range.to ?? ''}`)
    .join(',')
}

/** Repeated ranges replace the entire previous range, including open bounds. */
export function parseRangeFilterString(value: string): RangeFilters {
  return Object.fromEntries(
    filterEntries(value).map(([attribute, range]) => {
      const [from, to] = range.split('~')
      return [attribute, { from, to }]
    })
  )
}
