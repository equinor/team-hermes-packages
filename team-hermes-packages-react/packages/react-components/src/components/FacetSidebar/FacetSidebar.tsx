import { Accordion } from '@base-ui/react/accordion'
import { Button, Icon } from '@equinor/eds-core-react'
import { filter_list, unfold_less, unfold_more } from '@equinor/eds-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RangeFiltering } from '../../hooks/useRangeFilters/useRangeFilters'
import type { TermFiltering } from '../../hooks/useTermFilters/useTermFilters'
import type { Facet } from '../../shared/types/facet.types'
import type { FacetPickerGroup } from '../GroupedFacetPicker/GroupedFacetPicker'
import { GroupedFacetPicker } from '../GroupedFacetPicker/GroupedFacetPicker'
import { ScrollArea } from '../ScrollArea/ScrollArea'
import { ActiveFilters } from './ActiveFilters'
import { SidebarFacet } from './SidebarFacet'

export type FacetSidebarProps = {
  /** Return value of `useTermFilters`. Create it once in the page and pass it down. */
  termFiltering: TermFiltering
  /** Return value of `useRangeFilters`. Create it once in the page and pass it down. */
  rangeFiltering: RangeFiltering
  /** Facets the active search aggregated. Must include every key in `enabledFacets` once loaded. */
  facets: Facet[]
  /** Keys of the facets shown as sections, in order. Typically the pinned facets plus every active filter. */
  enabledFacets: string[]
  /** Addable facets for the "Add filter" picker, grouped by the host's taxonomy. */
  pickerGroups: FacetPickerGroup<Facet>[]
  /** Loading state of the search; shows a spinner in sections whose data has not arrived. */
  isFetching?: boolean
  /** Keys of pinned facets, which get no remove button. */
  pinnedFacets?: string[]
  /** Unit labels keyed by the output of `parseFacetLabel` (e.g. `{ porosity: '%' }`). */
  facetUnits?: Record<string, string | undefined>
  /** Maps a facet key to its display label (headers, chips, picker, unit lookup). Defaults to the key. */
  parseFacetLabel?: (key: string) => string
}

/**
 * Ready-made filter sidebar: active filter chips, one collapsible section per enabled facet,
 * and an "Add filter" picker. It holds no filter or fetch logic of its own: create
 * `useTermFilters` and `useRangeFilters` once in the page and pass their return values down, along
 * with the fetched facets.
 */
export function FacetSidebar({
  termFiltering,
  rangeFiltering,
  facets,
  enabledFacets,
  pickerGroups,
  isFetching = false,
  pinnedFacets = [],
  facetUnits = {},
  parseFacetLabel = (key) => key,
}: FacetSidebarProps) {
  const { termFilters, toggleTermFilterValue, addTermFilters, removeTermFilter, setTermFilters } = termFiltering
  const { rangeFilters, toggleRange, addRangeFilters, removeRangeFilter, setRangeFilters } = rangeFiltering
  const [openSidebarFacets, setOpenSidebarFacets] = useState<Map<string, boolean>>(new Map())
  const facetsByKey = useMemo(() => new Map(facets.map((facet) => [facet.key, facet])), [facets])
  const hasActiveFilters = Object.keys(termFilters).length > 0 || Object.keys(rangeFilters).length > 0

  // Newly enabled facets default to open; facets that are no longer enabled are dropped so stale state doesn't leak.
  useEffect(() => {
    setOpenSidebarFacets((prev) => {
      const next = new Map(prev)
      let changed = false
      for (const key of enabledFacets) {
        if (!next.has(key)) {
          next.set(key, true)
          changed = true
        }
      }
      for (const key of Array.from(next.keys())) {
        if (!enabledFacets.includes(key)) {
          next.delete(key)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [enabledFacets])

  function clearAllFilters() {
    setTermFilters(null)
    setRangeFilters(null)
  }

  const sidebarRef = useRef<HTMLDivElement>(null)
  const [pendingScrollFacet, setPendingScrollFacet] = useState<string | null>(null)
  const allCollapsed = Array.from(openSidebarFacets.values()).every((isOpen) => !isOpen)
  const openFacetValues = enabledFacets.filter((key) => openSidebarFacets.get(key) !== false)

  // Waits until the newly added facet is enabled and rendered before scrolling to it.
  useEffect(() => {
    if (!pendingScrollFacet || !enabledFacets.includes(pendingScrollFacet)) return
    const target = sidebarRef.current?.querySelector<HTMLElement>(
      `[data-facet-key="${CSS.escape(pendingScrollFacet)}"]`
    )
    target?.scrollIntoView({ behavior: 'instant', block: 'center' })
    setPendingScrollFacet(null)
  }, [pendingScrollFacet, enabledFacets])

  function onAddFacets(items: Facet[]) {
    addRangeFilters(items.filter((facet) => facet.kind === 'range').map((facet) => ({ attribute: facet.key })))
    addTermFilters(items.filter((facet) => facet.kind === 'term').map((facet) => ({ attribute: facet.key })))
    setPendingScrollFacet(items[0]?.key ?? null)
  }

  function onRemoveFacet(key: string) {
    removeTermFilter(key)
    removeRangeFilter(key)
  }

  return (
    <div ref={sidebarRef} className="w-full h-full bg-surface flex flex-col overflow-hidden p-1">
      <ScrollArea className="pb-2">
        <div className="flex flex-col gap-2 pb-3 sticky top-0 bg-surface z-4">
          <div className="flex items-center gap-2">
            <Icon data={filter_list} size={24} color="var(--color-theme-accent-fg)" />
            <span className="text-lg font-semibold">Filters</span>
            <Button
              variant="ghost"
              className="ml-auto!"
              onClick={() => setOpenSidebarFacets(new Map(enabledFacets.map((facet) => [facet, allCollapsed])))}
              title={allCollapsed ? 'Expand all filters' : 'Collapse all filters'}
            >
              {allCollapsed ? 'Expand all' : 'Collapse all'}
              <Icon data={allCollapsed ? unfold_more : unfold_less} size={18} />
            </Button>
          </div>
          <ActiveFilters
            termFiltering={termFiltering}
            rangeFiltering={rangeFiltering}
            parseFacetLabel={parseFacetLabel}
          />
        </div>
        <Accordion.Root
          className="flex flex-col gap-2 pl-1 pr-3"
          multiple
          value={openFacetValues}
          onValueChange={(values: string[]) => {
            setOpenSidebarFacets(new Map(enabledFacets.map((key) => [key, values.includes(key)])))
          }}
        >
          {enabledFacets.map((key) => (
            <SidebarFacet
              key={key}
              facetKey={key}
              facet={facetsByKey.get(key)}
              parseFacetLabel={parseFacetLabel}
              isFetching={isFetching}
              onRemove={!pinnedFacets.includes(key) ? () => onRemoveFacet(key) : undefined}
              selectedValues={Object.hasOwn(termFilters, key) ? termFilters[key] : undefined}
              unit={facetUnits[parseFacetLabel(key)]}
              onToggle={(value) => toggleTermFilterValue(key, value)}
              range={Object.hasOwn(rangeFilters, key) ? rangeFilters[key] : undefined}
              onRangeChange={toggleRange}
            />
          ))}
        </Accordion.Root>
        <div className="z-5 sticky bottom-0 bg-surface gap-2 p-2 flex flex-col justify-center items-center">
          <GroupedFacetPicker
            groups={pickerGroups}
            onSubmit={onAddFacets}
            parseItemLabel={(f) => parseFacetLabel(f.key)}
          />
          {hasActiveFilters && (
            <Button variant="outlined" className="w-full" onClick={clearAllFilters}>
              Reset filters
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
