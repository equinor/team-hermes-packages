import { useState } from 'react'
import { FacetOption } from '../FacetOption/FacetOption'

const INITIAL_VISIBLE_COUNT = 8

export type TermFilterBucket = {
  value: string
  count: number
}

export type TermFilterProps = {
  /** Facet name, used in the search placeholder. */
  label: string
  /** Available terms with their result counts. */
  buckets: TermFilterBucket[]
  /** Currently selected term values. */
  selectedValues: string[]
  /** Called with the term value when the user toggles an option. */
  onToggle: (value: string) => void
}

/**
 * List of selectable terms for a facet. Shows the first 8 terms with a "show more" toggle,
 * and a search field when there are more terms than that. Selected terms stay on top while searching.
 */
export function TermFilter({ label, buckets, selectedValues, onToggle }: TermFilterProps) {
  const [showAll, setShowAll] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const hasMore = buckets.length > INITIAL_VISIBLE_COUNT
  const isSearching = searchTerm.length > 0
  const lowerSearch = searchTerm.toLowerCase()

  const matches = (b: TermFilterBucket) => b.value.toLowerCase().includes(lowerSearch)
  const filteredBuckets = isSearching
    ? [
        ...buckets.filter((b) => selectedValues.includes(b.value) && matches(b)),
        ...buckets.filter((b) => !selectedValues.includes(b.value) && matches(b)),
      ]
    : buckets

  const visibleBuckets = isSearching || showAll ? filteredBuckets : filteredBuckets.slice(0, INITIAL_VISIBLE_COUNT)

  return (
    <div className="flex flex-col">
      {hasMore && (
        <input
          type="text"
          aria-label={`Search ${label}`}
          className="mb-1 p-1.5 text-center text-sm border border-stroke-medium bg-transparent rounded focus:border-stroke-strong outline-none"
          placeholder={`Search ${label}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      )}
      <div className="flex flex-col max-h-72 overflow-y-auto px-1">
        {visibleBuckets.map((bucket) => (
          <FacetOption
            key={bucket.value}
            label={bucket.value}
            count={bucket.count}
            checked={selectedValues.includes(bucket.value)}
            onChange={() => onToggle(bucket.value)}
          />
        ))}
      </div>
      {isSearching && filteredBuckets.length === 0 && (
        <div className="p-3 text-center text-xs">No matches for &quot;{searchTerm}&quot;</div>
      )}
      {!isSearching && hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="self-center text-xs text-color-theme hover:underline"
        >
          {showAll ? 'Show less' : `Show ${buckets.length - INITIAL_VISIBLE_COUNT} more`}
        </button>
      )}
    </div>
  )
}
