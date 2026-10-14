import { Combobox } from '@base-ui/react/combobox'
import { Button, Icon } from '@equinor/eds-core-react'
import { add, check, chevron_down, search } from '@equinor/eds-icons'
import { useState } from 'react'
import { Chip } from '../Chip/Chip'

export type FacetPickerItem = {
  /** Unique facet key. */
  key: string
  /** Term facets get a "text" chip in the list. */
  kind: 'term' | 'range'
  /** Optional result count shown on the right. */
  count?: number | null
}

export type FacetPickerGroup<T extends FacetPickerItem = FacetPickerItem> = {
  /** Category heading (e.g. "Site", "Sample"). */
  value: string
  items: T[]
}

export type GroupedFacetPickerProps<T extends FacetPickerItem = FacetPickerItem> = {
  buttonLabel?: string
  /** Addable items grouped into categories. */
  groups: FacetPickerGroup<T>[]
  /** Called with every item the user picked. */
  onSubmit: (items: T[]) => void
  /** Maps an item to the label shown in the list and used for search. Defaults to `item.key`. */
  parseItemLabel?: (item: T) => string
}

/**
 * "Add filter" picker whose options are organised into collapsible category sections.
 * Clicking an item applies it immediately; "Select multiple" switches to checkboxes and
 * applies the picked items in one batch.
 */
export function GroupedFacetPicker<T extends FacetPickerItem = FacetPickerItem>({
  buttonLabel = 'Add Filter',
  groups,
  onSubmit,
  parseItemLabel = (item) => item.key,
}: GroupedFacetPickerProps<T>) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<T[]>([])
  const [inputValue, setInputValue] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [multiSelect, setMultiSelect] = useState(false)

  // Render the trigger as long as there are categories to offer; groups may
  // have empty item lists until their lazy options load on open.
  if (groups.length === 0) return null

  const reset = () => {
    setSelected([])
    setInputValue('')
    setCollapsed(new Set())
    setShowSelectedOnly(false)
    setMultiSelect(false)
  }

  const close = () => {
    setOpen(false)
    reset()
  }

  // Leaving multi-select mode discards any pending checkbox selection so the
  // next single click applies cleanly.
  const toggleMultiSelect = () => {
    setMultiSelect((prev) => {
      if (prev) {
        setSelected([])
        setShowSelectedOnly(false)
      }
      return !prev
    })
  }

  const isSearching = inputValue.trim().length > 0
  const isSelected = (item: T) => selected.some((s) => s.key === item.key)

  // When "selected only" is active, restrict the list to checked items so the
  // user can review their choices before applying them.
  const displayGroups = showSelectedOnly
    ? groups.map((g) => ({ ...g, items: g.items.filter(isSelected) })).filter((g) => g.items.length > 0)
    : groups

  const toggleGroup = (groupValue: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(groupValue)) next.delete(groupValue)
      else next.add(groupValue)
      return next
    })
  }

  const confirm = () => {
    onSubmit(selected)
    close()
  }

  return (
    <Combobox.Root<T, true>
      multiple
      items={displayGroups}
      open={open}
      value={selected}
      inputValue={inputValue}
      itemToStringLabel={parseItemLabel}
      itemToStringValue={(item) => item.key}
      onValueChange={(items) => {
        if (multiSelect) {
          setSelected(items)
        } else {
          // Single-select default: apply the just-clicked item immediately.
          const picked = items[items.length - 1]
          if (picked) {
            onSubmit([picked])
            close()
          }
        }
      }}
      onInputValueChange={(next) => setInputValue(next)}
      onOpenChange={(open) => {
        if (open) {
          reset()
          setOpen(true)
        } else {
          close()
        }
      }}
    >
      <Combobox.Trigger
        render={
          <Button className="font-semibold w-full">
            <Icon data={add} size={24} />
            <span className="font-medium uppercase text-sm">{buttonLabel}</span>
          </Button>
        }
      />

      <Combobox.Portal>
        <Combobox.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Combobox.Positioner className="fixed! inset-0! transform-none! z-50 flex items-center justify-center p-4">
          <Combobox.Popup className="bg-surface border border-stroke-medium rounded shadow-lg w-full max-w-lg max-h-[min(var(--available-height),32rem)] flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-stroke-medium">
              <Icon data={search} size={16} className="text-secondary shrink-0" />
              <Combobox.Input
                placeholder="Search filters..."
                className="flex-1 text-base outline-none! bg-transparent"
              />
              {multiSelect && selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSelectedOnly((v) => !v)}
                  className="shrink-0 text-xs text-color-theme hover:underline"
                >
                  {showSelectedOnly ? 'Show all' : `Show selected (${selected.length})`}
                </button>
              )}
            </div>

            <Combobox.List className="flex-1 min-h-0 overflow-y-auto p-1">
              {(group: FacetPickerGroup<T>) => {
                const expanded = isSearching || showSelectedOnly || !collapsed.has(group.value)
                return (
                  <Combobox.Group key={group.value} items={group.items} className="flex flex-col">
                    <Combobox.GroupLabel
                      render={
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.value)}
                          className="flex items-center gap-2 w-full px-2 pt-2 pb-1 text-left"
                        />
                      }
                    >
                      <Icon
                        data={chevron_down}
                        size={16}
                        className={`shrink-0 text-secondary transition-transform ${expanded ? '' : '-rotate-90'}`}
                      />
                      <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                        {group.value}
                      </span>
                    </Combobox.GroupLabel>
                    {expanded && (
                      <Combobox.Collection>
                        {(item: T, index: number) => (
                          <Combobox.Item
                            key={item.key}
                            value={item}
                            index={index}
                            className="flex items-center justify-between gap-2 p-2 rounded text-sm cursor-pointer data-highlighted:bg-surface-hover hover:bg-surface-hover"
                          >
                            <span className="flex items-center gap-2">
                              {multiSelect && (
                                <span
                                  className={`flex items-center justify-center w-4 h-4 rounded-sm border shrink-0 ${
                                    isSelected(item)
                                      ? 'bg-theme-accent-fg border-theme-accent-fg'
                                      : 'border-stroke-medium'
                                  }`}
                                >
                                  {isSelected(item) && <Icon data={check} size={16} color="white" />}
                                </span>
                              )}
                              {parseItemLabel(item)}
                              {item.kind === 'term' && (
                                <Chip fontSize="xs" theme="info">
                                  text
                                </Chip>
                              )}
                            </span>
                            {item.count != null && (
                              <span className="text-xs text-secondary">{item.count.toLocaleString()}</span>
                            )}
                          </Combobox.Item>
                        )}
                      </Combobox.Collection>
                    )}
                  </Combobox.Group>
                )
              }}
            </Combobox.List>

            <Combobox.Empty>
              <div className="px-3 py-4 text-center text-xs text-secondary">No filters found</div>
            </Combobox.Empty>

            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-stroke-medium">
              <button type="button" onClick={toggleMultiSelect} className="text-xs text-color-theme hover:underline">
                {multiSelect ? 'Single select' : 'Select multiple'}
              </button>
              <div className="flex items-center gap-2">
                {multiSelect && <span className="text-xs text-secondary">{selected.length} selected</span>}
                <Button variant="ghost" onClick={close}>
                  Cancel
                </Button>
                {multiSelect && (
                  <Button onClick={confirm} disabled={selected.length === 0}>
                    Add filters
                  </Button>
                )}
              </div>
            </div>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
