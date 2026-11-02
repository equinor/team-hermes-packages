import { Popover as BasePopover } from '@base-ui/react'

type PopoverBaseProps = {
  children: React.ReactNode
  id?: string
  onOpenCallback?: () => void
  onCloseCallback?: () => void
  testIds?: {
    portal?: string
    popup?: string
  }
}

type PopoverWithTrigger = PopoverBaseProps & {
  trigger: React.ReactElement
  open?: never
  setIsOpen?: never
}

type PopoverControlled = PopoverBaseProps & {
  trigger?: never
  open: boolean
  setIsOpen: (open: boolean) => void
}

type PopoverProps = PopoverWithTrigger | PopoverControlled

export const Popover = (props: PopoverProps) => {
  const { children, onOpenCallback, onCloseCallback, testIds } = props

  const isControlled = 'open' in props && props.open !== undefined

  return (
    <BasePopover.Root
      onOpenChangeComplete={onOpenCallback}
      onOpenChange={(open) => {
        if (!open) onCloseCallback?.()
        if (isControlled) props.setIsOpen(open)
      }}
      {...(isControlled ? { open: props.open } : {})}
    >
      {'trigger' in props && props.trigger !== undefined ? <BasePopover.Trigger render={props.trigger} /> : null}

      <BasePopover.Portal data-testid={testIds?.portal}>
        <BasePopover.Positioner sideOffset={8}>
          <BasePopover.Popup className="popup-animation menu-popup" data-testid={testIds?.popup}>
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  )
}

Popover.Trigger = BasePopover.Trigger
Popover.createHandle = BasePopover.createHandle
