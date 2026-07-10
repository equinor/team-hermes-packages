import { AlertDialog } from '@base-ui/react'
import { Button } from '@equinor/eds-core-react'
import { ActionButton } from '../../shared/components/ActionButton/ActionButton'
import type { Theme } from '../../shared/types/themes.type'

type ConfirmOperationDialogBaseProps = {
  theme?: Theme
  title: string
  description?: string
  confirmButtonText?: string
  cancelButtonText?: string
  onConfirm: () => void
  operationIsLoading?: boolean
  confirmButtonColor?: 'primary' | 'danger'
}

type ConfirmOperationDialogWithTrigger = ConfirmOperationDialogBaseProps & {
  trigger: React.ReactElement
  isOpen?: never
  setIsOpen?: never
}

type ConfirmOperationDialogControlled = ConfirmOperationDialogBaseProps & {
  trigger?: never
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

type ConfirmOperationDialogProps = ConfirmOperationDialogWithTrigger | ConfirmOperationDialogControlled

export function ConfirmOperationDialog(props: ConfirmOperationDialogProps) {
  const {
    title,
    description,
    confirmButtonText = 'Yes, confirm',
    cancelButtonText = 'Cancel',
    onConfirm,
    confirmButtonColor = 'danger',
  } = props

  const isControlled = 'isOpen' in props && props.isOpen !== undefined

  return (
    <AlertDialog.Root {...(isControlled ? { open: props.isOpen, onOpenChange: props.setIsOpen } : {})}>
      {'trigger' in props && props.trigger !== undefined ? <AlertDialog.Trigger render={props.trigger} /> : null}
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="dialog-backdrop" />
        <AlertDialog.Popup className="dialog-popup-base popup-animation -mt-8 w-96 max-w-[calc(100vw-3rem)]">
          <div className="flex flex-col gap-4">
            <h1 className="text-md font-medium">{title}</h1>
            {description && <p>{description}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <AlertDialog.Close render={<Button variant="outlined">{cancelButtonText}</Button>} />
              <ActionButton
                color={confirmButtonColor}
                onClick={() => {
                  if (isControlled) props.setIsOpen(false)
                  onConfirm()
                }}
                isLoading={props.operationIsLoading}
              >
                {confirmButtonText}
              </ActionButton>
            </div>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
