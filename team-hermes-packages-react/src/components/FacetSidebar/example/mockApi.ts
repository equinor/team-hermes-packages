import type { Facet } from '../../../shared/types/facet.types'
import type { RangeFilters, TermFilters } from '../../../shared/utils/urlFilterCodecs'

/**
 * In-memory stand-in for a faceted search backend, used by the full example.
 * Replace with real HTTP calls; the request and response shapes are what matters.
 */

export type View = 'wells' | 'samples' | 'reports'
export type Row = Record<string, string | number>

type FacetDefinition = {
  key: string
  kind: 'term' | 'range'
  valueType: 'string' | 'number' | 'date'
  unit?: string
  group: 'Site' | 'Measurements'
}

export type SearchRequest = {
  page: number
  per_page: number
  terms: TermFilters
  ranges: RangeFilters
  aggregate_facets: string[]
}

export type SearchResponse = { rows: Row[]; total: number; facets: Facet[] }

const countries = ['Norway', 'UK', 'Netherlands', 'Denmark']
const fields = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']
const statuses = ['Producing', 'Suspended', 'Abandoned']
const sampleTypes = ['Core plug', 'Sidewall core', 'Cuttings']
const reportTypes = ['Geology', 'Petrophysics', 'Drilling', 'Reservoir']

// Small deterministic generator so the data (and stories) are stable between reloads
let seed = 7
function random() {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}
const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)]
const isoDate = (year: number) => `${year}-${String(1 + Math.floor(random() * 12)).padStart(2, '0')}-15`

const data: Record<View, Row[]> = {
  wells: Array.from({ length: 80 }, (_, i) => ({
    name: `${10 + (i % 40)}/${1 + Math.floor(i / 40)}-${i + 1}`,
    country: pick(countries),
    field: pick(fields),
    status: pick(statuses),
    total_depth: Math.round(1500 + random() * 3500),
    spud_date: isoDate(1985 + Math.floor(random() * 35)),
  })),
  samples: Array.from({ length: 150 }, (_, i) => ({
    sample_id: `S-${1000 + i}`,
    country: pick(countries),
    field: pick(fields),
    sample_type: pick(sampleTypes),
    depth: Math.round(1500 + random() * 3000),
    porosity: Math.round(random() * 350) / 10,
  })),
  reports: Array.from({ length: 60 }, (_, i) => ({
    title: `Report ${i + 1}`,
    country: pick(countries),
    field: pick(fields),
    report_type: pick(reportTypes),
    published: isoDate(1990 + Math.floor(random() * 30)),
  })),
}

const definitions: Record<View, FacetDefinition[]> = {
  wells: [
    { key: 'country', kind: 'term', valueType: 'string', group: 'Site' },
    { key: 'field', kind: 'term', valueType: 'string', group: 'Site' },
    { key: 'status', kind: 'term', valueType: 'string', group: 'Site' },
    { key: 'total_depth', kind: 'range', valueType: 'number', unit: 'm', group: 'Site' },
    { key: 'spud_date', kind: 'range', valueType: 'date', group: 'Site' },
  ],
  samples: [
    { key: 'country', kind: 'term', valueType: 'string', group: 'Site' },
    { key: 'field', kind: 'term', valueType: 'string', group: 'Site' },
    { key: 'sample_type', kind: 'term', valueType: 'string', group: 'Measurements' },
    { key: 'depth', kind: 'range', valueType: 'number', unit: 'm', group: 'Measurements' },
    { key: 'porosity', kind: 'range', valueType: 'number', unit: '%', group: 'Measurements' },
  ],
  reports: [
    { key: 'country', kind: 'term', valueType: 'string', group: 'Site' },
    { key: 'field', kind: 'term', valueType: 'string', group: 'Site' },
    { key: 'report_type', kind: 'term', valueType: 'string', group: 'Site' },
    { key: 'published', kind: 'range', valueType: 'date', group: 'Site' },
  ],
}

export const viewLabels: Record<View, string> = { wells: 'Wells', samples: 'Samples', reports: 'Reports' }

/** Facets pinned per view: always shown and not removable. */
export const pinnedFacets: Record<View, string[]> = {
  wells: ['country', 'field'],
  samples: ['country', 'field', 'sample_type'],
  reports: ['report_type'],
}

/** Filters that make sense in every view and so survive a view switch. */
export const globalFacets = ['country', 'field']

export const facetUnits = Object.fromEntries(
  Object.values(definitions)
    .flat()
    .map((definition) => [definition.key, definition.unit])
)

export const facetGroup = (facet: Facet) => (facet.source === null ? 'Site' : 'Measurements')

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function matches(row: Row, terms: TermFilters, ranges: RangeFilters, ignore?: string): boolean {
  for (const [attribute, values] of Object.entries(terms)) {
    if (attribute === ignore || !values.length || !(attribute in row)) continue
    if (!values.includes(String(row[attribute]))) return false
  }
  for (const [attribute, { from, to }] of Object.entries(ranges)) {
    if (attribute === ignore || !(attribute in row)) continue
    const value = row[attribute]
    const compare = (bound: number | string) =>
      typeof value === 'string' ? value.localeCompare(String(bound)) : value - Number(bound)
    if (from !== undefined && from !== null && from !== '' && compare(from) < 0) return false
    if (to !== undefined && to !== null && to !== '' && compare(to) > 0) return false
  }
  return true
}

function buildFacet(definition: FacetDefinition, rows: Row[], aggregated: boolean): Facet {
  const base = {
    key: definition.key,
    value_type: definition.valueType,
    source: definition.group === 'Measurements' ? 'measurements' : null,
    count: rows.length,
    aggregated,
  }

  if (definition.kind === 'term') {
    const counts = new Map<string, number>()
    if (aggregated) {
      for (const row of rows) {
        const value = String(row[definition.key])
        counts.set(value, (counts.get(value) ?? 0) + 1)
      }
    }
    return {
      ...base,
      kind: 'term',
      buckets: Array.from(counts, ([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    }
  }

  if (!aggregated || !rows.length) return { ...base, kind: 'range', histogram: null }

  if (definition.valueType === 'date') {
    const dates = rows.map((row) => String(row[definition.key])).sort()
    const counts = new Map<string, number>()
    for (const date of dates)
      counts.set(`${date.slice(0, 4)}-01-01`, (counts.get(`${date.slice(0, 4)}-01-01`) ?? 0) + 1)
    return {
      ...base,
      kind: 'range',
      histogram: {
        buckets: Array.from(counts, ([key, count]) => ({ key, count })),
        min: dates[0],
        max: dates[dates.length - 1],
      },
    }
  }

  const values = rows.map((row) => Number(row[definition.key]))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const width = (max - min) / 10 || 1
  const counts = Array.from({ length: 10 }, () => 0)
  for (const value of values) counts[Math.min(9, Math.floor((value - min) / width))]++
  return {
    ...base,
    kind: 'range',
    histogram: {
      buckets: counts.map((count, i) => ({ key: Math.round((min + i * width) * 10) / 10, count })),
      min,
      max,
      mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    },
  }
}

/** Results for one view plus the facets the request asked to aggregate. */
export async function search(view: View, request: SearchRequest): Promise<SearchResponse> {
  await delay(400)
  const filtered = data[view].filter((row) => matches(row, request.terms, request.ranges))
  const facets = definitions[view]
    .filter((definition) => request.aggregate_facets.includes(definition.key))
    // A facet ignores its own filter so its other options stay visible
    .map((definition) =>
      buildFacet(
        definition,
        data[view].filter((row) => matches(row, request.terms, request.ranges, definition.key)),
        true
      )
    )
  const start = request.page * request.per_page
  return { rows: filtered.slice(start, start + request.per_page), total: filtered.length, facets }
}

/** Every facet available in a view, without bucket data. Used to build the picker. */
export async function fetchFacetCatalog(view: View): Promise<Facet[]> {
  await delay(800)
  return definitions[view].map((definition) => buildFacet(definition, [], false))
}
