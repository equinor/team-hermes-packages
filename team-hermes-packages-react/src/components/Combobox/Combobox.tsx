import { Combobox as BaseCombobox } from '@base-ui/react'
import { Icon, Typography } from '@equinor/eds-core-react'
import { check, chevron_down, close } from '@equinor/eds-icons'
import React, { useId } from 'react'

export type ComboboxItem = {
  label: string
  value: string | number | boolean
}

type ComboboxBaseProps = {
  autoFocus?: boolean
  label?: string
  items: ComboboxItem[]
  placeholder?: string
  disabled?: boolean
  style?: React.CSSProperties
  error?: string
  clearable?: boolean
  fitToTriggerWidth?: boolean
  containerRef?: React.RefObject<any>
  testIdBase?: string
  defaultInputValue?: string
  onClose?: () => void
}

type ComboboxMultipleProps = ComboboxBaseProps & {
  multiple: true
  value: ComboboxItem[]
  onChange: (value: ComboboxItem[]) => void
}

type ComboboxSingleProps = ComboboxBaseProps & {
  multiple?: false
  value: ComboboxItem | null
  onChange: (value: ComboboxItem | null) => void
}

type ComboboxProps = ComboboxMultipleProps | ComboboxSingleProps

export function Combobox(props: ComboboxProps) {
  const { items, placeholder, label, multiple, value, onChange, testIdBase, error } = props
  const inputId = useId()

  return (
    <BaseCombobox.Root
      items={items}
      multiple={multiple}
      value={value}
      onValueChange={(newValue, { reason }) => {
        if (reason === 'escape-key') {
          ;(onChange as (value: ComboboxItem | ComboboxItem[] | null) => void)(value)
          return
        }
        ;(onChange as (value: ComboboxItem | ComboboxItem[] | null) => void)(newValue)
      }}
      onOpenChange={(open) => {
        if (!open) props.onClose?.()
      }}
      disabled={props.disabled}
      defaultOpen={props.autoFocus}
      defaultInputValue={props.defaultInputValue}
    >
      <div className="w-full flex flex-col gap-0.5" style={props.style} data-testid={testIdBase}>
        {label && <span className="text-xs pl-2">{label}</span>}
        <BaseCombobox.InputGroup className="w-full rounded-md border border-stroke-subtle bg-surface relative p-1.5 focus-within:outline-2 focus-within:outline-dashed focus-within:outline-theme-accent-fg">
          {multiple ? (
            <BaseCombobox.Chips className="flex w-full flex-wrap items-center gap-0.5">
              <BaseCombobox.Value>
                {(value: ComboboxItem[]) => (
                  <React.Fragment>
                    {value.map((option) => (
                      <BaseCombobox.Chip
                        key={String(option.value)}
                        className="flex items-center gap-1 rounded p-1 text-sm bg-surface-subtle"
                        aria-label={String(option.value)}
                      >
                        {String(option.value)}
                        <BaseCombobox.ChipRemove
                          className="rounded p-1 hover:bg-surface"
                          aria-label={`Remove ${String(option.value)} from selection`}
                        >
                          <Icon data={close} className="size-3" />
                        </BaseCombobox.ChipRemove>
                      </BaseCombobox.Chip>
                    ))}
                    <BaseCombobox.Input
                      enterKeyHint="search"
                      id={inputId}
                      aria-label={label}
                      placeholder={value.length > 0 ? '' : placeholder}
                      className="w-full p-1 flex-1 rounded focus:outline-0!"
                      data-testid={testIdBase ? `${testIdBase}-input` : undefined}
                      autoFocus={props.autoFocus}
                    />
                  </React.Fragment>
                )}
              </BaseCombobox.Value>
            </BaseCombobox.Chips>
          ) : (
            <>
              <BaseCombobox.Value>
                {(value: ComboboxItem | null) => (
                  <BaseCombobox.Input
                    id={inputId}
                    enterKeyHint="search"
                    aria-label={label}
                    placeholder={value ? value.label : placeholder}
                    className="w-full p-0.5 pr-8 rounded truncate focus:outline-0!"
                    data-testid={testIdBase ? `${testIdBase}-input` : undefined}
                    autoFocus={props.autoFocus}
                  />
                )}
              </BaseCombobox.Value>
              <div className="absolute right-2 bottom-0 flex h-10 items-center justify-center text-gray-400">
                {props.clearable && (
                  <BaseCombobox.Clear
                    className="combobox-clear flex h-10 w-6 items-center justify-center rounded bg-transparent p-0"
                    aria-label="Clear selection"
                    data-testid={testIdBase ? `${testIdBase}-clear` : undefined}
                  >
                    <Icon data={close} size={16} />
                  </BaseCombobox.Clear>
                )}
                <BaseCombobox.Trigger
                  className="flex h-10 w-6 items-center justify-center rounded bg-transparent p-0"
                  aria-label="Open popup"
                  data-testid={testIdBase ? `${testIdBase}-trigger` : undefined}
                >
                  <Icon data={chevron_down} />
                </BaseCombobox.Trigger>
              </div>
            </>
          )}
        </BaseCombobox.InputGroup>
        {error && (
          <Typography
            group="input"
            variant="helper"
            color="var(--color-theme-danger-fg)"
            style={{ marginTop: '0.5rem', marginLeft: 8 }}
          >
            {error}
          </Typography>
        )}
      </div>

      <BaseCombobox.Portal container={props.containerRef}>
        <BaseCombobox.Positioner className="z-50 outline-none" sideOffset={4} align="start">
          <BaseCombobox.Popup
            className={
              'popup-animation bg-surface max-h-[min(var(--available-height),23rem)] max-w-(--available-width) origin-(--transform-origin) overflow-y-auto scroll-pt-2 scroll-pb-2 overscroll-contain rounded py-2 outline-1 outline-stroke-subtle' +
              (props.fitToTriggerWidth ? ' w-(--anchor-width)' : ' w-auto')
            }
          >
            <BaseCombobox.Empty>
              <div className="px-4 py-2">No hits.</div>
            </BaseCombobox.Empty>
            <BaseCombobox.List>
              {(option: ComboboxItem) => (
                <BaseCombobox.Item
                  key={String(option.value)}
                  className="grid grid-cols-[0.75rem_1fr] items-center gap-2 py-2 px-4 relative hover:bg-surface-hover data-highlighted:bg-surface-hover rounded cursor-pointer"
                  value={option}
                  data-testid={testIdBase ? `${testIdBase}-option-${String(option.value)}` : undefined}
                >
                  <BaseCombobox.ItemIndicator className="col-start-1">
                    <Icon data={check} className="size-3" />
                  </BaseCombobox.ItemIndicator>
                  <span className="col-start-2">{option.label}</span>
                </BaseCombobox.Item>
              )}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  )
}
