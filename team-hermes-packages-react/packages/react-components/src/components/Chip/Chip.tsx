import { Icon, Tooltip } from '@equinor/eds-core-react'
import { close, type IconData } from '@equinor/eds-icons'

import { chip } from '@/components/Chip/Chip.styles'
import { ConditionalWrapper } from '@/shared/components/ConditionalWrapper'

type ChipProps = {
  children: React.ReactNode
  theme?: 'accent' | 'success' | 'info' | 'warning' | 'danger' | 'neutral'
  fontSize?: 'xs' | 'sm' | 'base' | 'lg'
  icon?: IconData
  onClick?: () => void
  onDismiss?: () => void
  chipTooltip?: string
  dismissTooltip?: string
  linkTo?: string
  LinkComponent?: React.ComponentType<React.ComponentProps<'a'> & { to: string }>
  ref?: React.Ref<HTMLElement>
} & Omit<React.HTMLAttributes<HTMLElement>, 'onClick'>

export const Chip = (props: ChipProps) => {
  const {
    children,
    theme = 'neutral',
    fontSize = 'sm',
    icon,
    onClick,
    onDismiss,
    chipTooltip,
    dismissTooltip,
    linkTo,
    LinkComponent,
    className,
    ref,
    ...rest
  } = props

  const isLink = !!linkTo
  const { root, content, dismiss } = chip({ size: fontSize, interactive: !!onClick || isLink })

  const Root: React.ElementType = isLink ? (LinkComponent ?? 'a') : 'div'
  const linkProps = isLink ? (LinkComponent ? { to: linkTo } : { href: linkTo }) : {}

  const withTooltip = (node: React.ReactElement<React.HTMLAttributes<HTMLElement>>) => (
    <Tooltip title={chipTooltip}>{node}</Tooltip>
  )

  return (
    <ConditionalWrapper condition={isLink} wrapper={withTooltip}>
      <Root
        data-color-appearance={theme}
        data-font-size={fontSize}
        className={root({ class: className })}
        ref={ref}
        {...linkProps}
        {...rest}
      >
        <ConditionalWrapper condition={!isLink} wrapper={withTooltip}>
          {onClick && !isLink ? (
            <button type="button" className={content({ class: `${className}_content` })} onClick={onClick}>
              {icon && <Icon data={icon} size={16} />}
              {children}
            </button>
          ) : (
            <span className={content({ class: `${className}_content` })}>
              {icon && <Icon data={icon} size={16} />}
              {children}
            </span>
          )}
        </ConditionalWrapper>
        {onDismiss && !isLink && (
          <Tooltip title={dismissTooltip}>
            <button
              type="button"
              className={dismiss({ class: `${className}_dismiss` })}
              aria-label="Dismiss"
              onClick={onDismiss}
            >
              <Icon data={close} size={16} />
            </button>
          </Tooltip>
        )}
      </Root>
    </ConditionalWrapper>
  )
}
