import { Menu } from '@base-ui/react'
import { Icon } from '@equinor/eds-core-react'
import { check } from '@equinor/eds-icons'

type MenuCheckboxListBaseProps = {
  options: { label: string; value: string; visible?: boolean }[]
  value: string[]
  onChange: (value: string[]) => void
  testIds?: {
    trigger?: string
    option?: (value: string) => string
    popup?: string
  }
}

type MenuCheckboxListWithTrigger = MenuCheckboxListBaseProps & {
  trigger: React.ReactElement
  open?: never
  setIsOpen?: never
}

type MenuCheckboxListControlled = MenuCheckboxListBaseProps & {
  trigger?: never
  open: boolean
  setIsOpen: (open: boolean) => void
}

type MenuCheckboxListProps = MenuCheckboxListWithTrigger | MenuCheckboxListControlled

export function MenuCheckboxList(props: MenuCheckboxListProps) {
  const { options, value, onChange, testIds } = props

  const isControlled = 'open' in props && props.open !== undefined

  return (
    <Menu.Root {...(isControlled ? { open: props.open, onOpenChange: props.setIsOpen } : {})}>
      {'trigger' in props && props.trigger !== undefined ? (
        <Menu.Trigger render={props.trigger} data-active={value?.length > 0} data-testid={testIds?.trigger} />
      ) : null}
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup className="menu-popup" data-testid={testIds?.popup}>
            {options?.map(
              (option) =>
                option.visible !== false && (
                  <Menu.CheckboxItem
                    key={option.value}
                    data-testid={testIds?.option?.(option.value)}
                    checked={value.includes(option.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onChange([...value, option.value])
                      } else {
                        onChange(value.filter((v) => v !== option.value))
                      }
                    }}
                    className="grid grid-cols-[1rem_1fr] items-center gap-2 p-2 text-sm data-highlighted:relative cursor-pointer data-highlighted:bg-surface-hover"
                  >
                    <Menu.CheckboxItemIndicator className="col-start-1">
                      <Icon data={check} size={16} />
                    </Menu.CheckboxItemIndicator>
                    <span className="col-start-2">{option.label}</span>
                  </Menu.CheckboxItem>
                )
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
