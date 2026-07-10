import { Button, type ButtonProps, Icon, Progress } from '@equinor/eds-core-react'
import type { IconData } from '@equinor/eds-icons'

type ActionButtonProps = ButtonProps & {
  isLoading?: boolean
  icon?: IconData
}

export function ActionButton(props: ActionButtonProps) {
  const { isLoading, icon, children, ...rest } = props
  return (
    <Button {...rest}>
      {!isLoading && icon && <Icon data={icon} />}
      {isLoading && <Progress.Circular size={16} />}
      {children}
    </Button>
  )
}
