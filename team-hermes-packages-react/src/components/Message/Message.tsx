import { Icon } from '@equinor/eds-core-react'
import { close } from '@equinor/eds-icons'
import { message } from './Message.styles'
import { ICON_TYPES, type MessageProps } from './types'

export const Message = (props: MessageProps) => {
  const {
    children,
    title,
    type = 'info',
    iconOverride,
    iconPosition = 'start',
    iconSize = 24,
    onDismiss,
    fullWidth = false,
    className,
    ...divProps
  } = props

  const messageStyles = message()
  const shouldShowIcon = iconPosition !== 'none'

  return (
    <div data-color-appearance={type} className={messageStyles.root({ fullWidth, className })} {...divProps}>
      <div
        className="flex gap-2 grow whitespace-pre-wrap items-center"
        style={{ flexDirection: iconPosition === 'end' ? 'row-reverse' : 'row' }}
      >
        {shouldShowIcon && <Icon className="shrink-0" size={iconSize} data={iconOverride || ICON_TYPES[type]} />}
        <div className="grow">
          {title && <p className="font-bold">{title}</p>}
          {children}
        </div>
      </div>
      {onDismiss && (
        <button
          data-color-appearance={type}
          className={messageStyles.dismiss()}
          aria-label={`Dismiss ${type} message`}
          onClick={onDismiss}
        >
          <Icon data={close} />
        </button>
      )}
    </div>
  )
}
