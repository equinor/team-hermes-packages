import { Autocomplete } from '@base-ui/react/autocomplete'
import { Icon } from '@equinor/eds-core-react'
import { close, search } from '@equinor/eds-icons'
import { useMemo, useRef, useState, type ReactNode } from 'react'

export type SearchAutocompleteItem = {
  /** Unique within its group. */
  id: string
  label: string
  icon?: ReactNode
  metadata?: ReactNode
}

export type SearchAutocompleteGroup<T extends SearchAutocompleteItem = SearchAutocompleteItem> = {
  /** Unique among groups. */
  id: string
  label: string
  icon?: ReactNode
  items: T[]
}

export type SearchAutocompleteProps<T extends SearchAutocompleteItem = SearchAutocompleteItem> = {
  value: string
  groups: SearchAutocompleteGroup<T>[]
  onValueChange: (value: string) => void
  onSearch: (query: string) => void
  onSelect: (item: T, group: SearchAutocompleteGroup<T>) => void
  isLoading?: boolean
  error?: string | null
  label?: string
  placeholder?: string
}

type Option<T extends SearchAutocompleteItem> = {
  item: T
  group: SearchAutocompleteGroup<T>
}

function sameOption<T extends SearchAutocompleteItem>(a: Option<T>, b: Option<T>) {
  return a.group.id === b.group.id && a.item.id === b.item.id
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const match = query.trim()
  const index = match ? text.toLocaleLowerCase().indexOf(match.toLocaleLowerCase()) : -1
  if (index < 0) return text
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-transparent font-semibold text-inherit">{text.slice(index, index + match.length)}</mark>
      {text.slice(index + match.length)}
    </>
  )
}

/** Controlled search input with consumer-provided, already-filtered suggestions. */
export function SearchAutocomplete<T extends SearchAutocompleteItem = SearchAutocompleteItem>({
  value,
  groups,
  onValueChange,
  onSearch,
  onSelect,
  isLoading = false,
  error,
  label = 'Search',
  placeholder = 'Search...',
}: SearchAutocompleteProps<T>) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState<Option<T> | undefined>()
  const highlightedRef = useRef<Option<T> | undefined>(undefined)
  const groupedOptions = useMemo(
    () => groups.map((group) => ({ group, options: group.items.map((item) => ({ item, group })) })),
    [groups]
  )
  const options = useMemo(() => groupedOptions.flatMap((entry) => entry.options), [groupedOptions])
  const currentHighlight = highlighted && options.find((option) => sameOption(option, highlighted))

  const updateHighlight = (option: Option<T> | undefined) => {
    highlightedRef.current = option
    setHighlighted(option)
  }

  const select = (option: Option<T>) => {
    updateHighlight(undefined)
    setOpen(false)
    onSelect(option.item, option.group)
  }

  return (
    <Autocomplete.Root<Option<T>>
      items={options}
      filteredItems={options}
      mode="list"
      value={value}
      open={open}
      openOnInputClick
      itemToStringValue={(option) => option.item.label}
      onValueChange={(next, details) => {
        if (details.reason === 'item-press') {
          details.cancel()
        } else {
          onValueChange(next)
        }
      }}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) updateHighlight(undefined)
      }}
      onItemHighlighted={(option, details) => {
        const previous = highlightedRef.current
        // A changed result list can cause Base UI to highlight a different item at the same index.
        if (details.reason === 'none' && previous && option && !sameOption(previous, option)) {
          updateHighlight(undefined)
        } else {
          updateHighlight(option)
        }
      }}
    >
      <Autocomplete.InputGroup
        className={`relative flex w-full items-center gap-2 rounded-md border border-stroke-subtle bg-surface px-3 py-2 focus-within:outline-2 focus-within:outline-dashed focus-within:outline-theme-accent-fg ${open ? 'z-50' : ''}`}
      >
        <Icon data={search} size={16} className="shrink-0 text-secondary" />
        <Autocomplete.Input
          aria-label={label}
          {...(!currentHighlight ? { 'aria-activedescendant': undefined } : {})}
          placeholder={placeholder}
          enterKeyHint="search"
          className="w-full min-w-0 bg-transparent outline-none!"
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
            event.preventDefault()
            event.preventBaseUIHandler()
            if (open && currentHighlight) {
              select(currentHighlight)
            } else if (value.trim()) {
              setOpen(false)
              updateHighlight(undefined)
              onSearch(value.trim())
            }
          }}
        />
        {value && !open && (
          <Autocomplete.Clear
            aria-label="Clear search"
            tabIndex={0}
            className="shrink-0 rounded p-1 hover:bg-surface-hover"
          >
            <Icon data={close} size={16} />
          </Autocomplete.Clear>
        )}
      </Autocomplete.InputGroup>
      <Autocomplete.Portal>
        <Autocomplete.Backdrop className="fixed inset-0 z-40 bg-black/20" />
        <Autocomplete.Positioner className="z-50 outline-none" sideOffset={4} align="start">
          <Autocomplete.Popup className="popup-animation w-(--anchor-width) max-w-(--available-width) max-h-[min(var(--available-height),23rem)] origin-(--transform-origin) overflow-y-auto rounded bg-surface py-2 shadow-lg outline-1 outline-stroke-subtle">
            {value && (
              <div className="flex justify-end px-3">
                <Autocomplete.Clear tabIndex={0} className="rounded px-2 py-1 text-xs hover:bg-surface-hover">
                  Clear search
                </Autocomplete.Clear>
              </div>
            )}
            {isLoading && (
              <div role="status" className="px-4 py-2 text-sm text-secondary">
                Loading suggestions...
              </div>
            )}
            {!isLoading && error && (
              <div role="alert" className="px-4 py-2 text-sm">
                {error}
              </div>
            )}
            {!isLoading && !error && options.length === 0 && (
              <div role="status" className="px-4 py-2 text-sm text-secondary">
                No suggestions.
              </div>
            )}
            <Autocomplete.List>
              {groupedOptions.map(({ group, options: groupOptions }) =>
                groupOptions.length > 0 ? (
                  <Autocomplete.Group key={group.id} className="px-1">
                    <Autocomplete.GroupLabel className="flex items-center gap-2 px-3 pt-2 pb-1 text-xs font-semibold text-secondary">
                      {group.icon}
                      {group.label}
                    </Autocomplete.GroupLabel>
                    {groupOptions.map((option) => {
                      const { item } = option
                      const isHighlighted = currentHighlight && sameOption(currentHighlight, option)
                      return (
                        <Autocomplete.Item
                          key={item.id}
                          value={option}
                          onClick={() => select(option)}
                          className={`flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm hover:bg-surface-hover ${isHighlighted ? 'bg-surface-hover' : ''}`}
                        >
                          {item.icon}
                          <span className="min-w-0 flex-1">
                            <HighlightedText text={item.label} query={value} />
                          </span>
                          {item.metadata != null && <span className="text-xs text-secondary">{item.metadata}</span>}
                        </Autocomplete.Item>
                      )
                    })}
                  </Autocomplete.Group>
                ) : null
              )}
            </Autocomplete.List>
            <div className="border-t border-stroke-subtle px-4 pt-2 text-xs text-secondary">
              Use arrow keys to navigate, Enter to select or search, Escape to close.
            </div>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  )
}
