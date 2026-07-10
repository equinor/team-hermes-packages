import { ContextMenu as BaseContextMenu } from '@base-ui/react'
import { Icon } from '@equinor/eds-core-react'
import { chevron_right, type IconData } from '@equinor/eds-icons'

export type ContextMenuItem = {
  label: string
  shortcut?: string
  onClick?: () => void
  subItems?: ContextMenuItem[]
  hidden?: boolean
  icon?: IconData
}

type ContextMenuBaseProps = {
  items: ContextMenuItem[]
  container?: React.RefObject<any>
}

type ContextMenuWithTrigger = ContextMenuBaseProps & {
  trigger: React.ReactNode
  open?: never
  setIsOpen?: never
  triggerId?: never
  triggerRef?: never
}

type ContextMenuControlled = ContextMenuBaseProps & {
  trigger?: never
  open: boolean
  setIsOpen: (open: boolean) => void
  triggerId: string
  triggerRef: React.RefObject<any>
}

type ContextMenuProps = ContextMenuWithTrigger | ContextMenuControlled

export function ContextMenu(props: ContextMenuProps) {
  const { items, container } = props
  return (
    <BaseContextMenu.Root
      {...('open' in props && props.open !== undefined
        ? { open: props.open, onOpenChange: props.setIsOpen, triggerId: props.triggerId }
        : {})}
    >
      {'trigger' in props && props.trigger !== undefined ? (
        <BaseContextMenu.Trigger>{props.trigger}</BaseContextMenu.Trigger>
      ) : null}
      <BaseContextMenu.Portal container={container}>
        <BaseContextMenu.Positioner
          className="z-50"
          {...('triggerRef' in props && props.triggerRef !== undefined ? { anchor: props.triggerRef } : {})}
        >
          <BaseContextMenu.Popup className="menu-popup">
            {items?.map((item) => {
              if (item.subItems && !item.hidden) {
                return (
                  <BaseContextMenu.SubmenuRoot key={item.label}>
                    <BaseContextMenu.SubmenuTrigger className="menu-item">
                      {item.icon && <Icon data={item.icon} size={16} />}
                      {item.label}
                      <Icon data={chevron_right} size={16} className="ml-auto" />
                    </BaseContextMenu.SubmenuTrigger>
                    <BaseContextMenu.Portal>
                      <BaseContextMenu.Positioner className="z-50" alignOffset={-4} sideOffset={-4}>
                        <BaseContextMenu.Popup className="menu-popup">
                          {item.subItems?.map((subItem) =>
                            subItem.hidden ? null : (
                              <BaseContextMenu.Item
                                className="menu-item"
                                key={subItem.label}
                                onClick={subItem.onClick}
                              >
                                {subItem.icon && <Icon data={subItem.icon} size={16} />}
                                {subItem.label}
                                {subItem.shortcut && <span className="menu-shortcut">{subItem.shortcut}</span>}
                              </BaseContextMenu.Item>
                            )
                          )}
                        </BaseContextMenu.Popup>
                      </BaseContextMenu.Positioner>
                    </BaseContextMenu.Portal>
                  </BaseContextMenu.SubmenuRoot>
                )
              }
              return item.hidden ? null : (
                <BaseContextMenu.Item className="menu-item" key={item.label} onClick={item.onClick}>
                  {item.icon && <Icon data={item.icon} size={16} />}
                  {item.label}
                  {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
                </BaseContextMenu.Item>
              )
            })}
          </BaseContextMenu.Popup>
        </BaseContextMenu.Positioner>
      </BaseContextMenu.Portal>
    </BaseContextMenu.Root>
  )
}
