import { Icon } from '@equinor/eds-core-react'
import { chevron_right, type IconData, lock } from '@equinor/eds-icons'
import { Chip, IconContainer } from '@/components'
import type { Theme } from '@/shared/types'
import { ConditionalWrapper } from '@/shared/components/ConditionalWrapper'

type ActionListItemProps = {
  /** EDS icon displayed in the item. */
  icon: IconData
  /** Primary text for the item. */
  title: string
  /** Secondary text shown below the title. */
  description: string
  /** Navigation target URL. Wrapped in LinkComponent or a plain anchor. */
  linkTo: string
  /** Color theme for the icon container. */
  variant?: Theme
  /** When true, disables interaction and shows a lock chip. */
  locked?: boolean
  /** Text displayed in the lock chip. Defaults to "No access". */
  lockedReason?: string
  /** Router-aware link component. Falls back to a plain `<a>` tag. */
  LinkComponent?: React.ComponentType<React.ComponentProps<'a'> & { to: string }>
}

export function ActionListItem(props: ActionListItemProps) {
  const { icon, title, description, linkTo, variant = 'success', locked = false, lockedReason, LinkComponent } = props
  return (
    <ConditionalWrapper
      condition={!!linkTo && !locked}
      wrapper={(children: React.ReactNode) =>
        LinkComponent ? (
          <LinkComponent to={linkTo || ''} style={{ textDecoration: 'none', color: 'inherit' }}>
            {children}
          </LinkComponent>
        ) : (
          <a href={linkTo || ''} style={{ textDecoration: 'none', color: 'inherit' }}>
            {children}
          </a>
        )
      }
    >
      <div
        className="flex items-center gap-4 px-6 py-4 transition-[background] duration-150 data-[locked='false']:hover:bg-surface-hover data-[locked='true']:cursor-not-allowed data-[locked='true']:opacity-55 group"
        data-locked={locked}
      >
        <IconContainer icon={icon} iconSize={18} size={42} variant={variant} />
        <div className="flex-1 flex flex-col gap-0.5">
          <span className="font-bold">{title}</span>
          <span className="text-meta">{description}</span>
        </div>
        {locked ? (
          <Chip theme="neutral" fontSize="xs" icon={lock}>
            {lockedReason || 'No access'}
          </Chip>
        ) : (
          <span
            data-locked={locked}
            className="shrink-0 transition-transform duration-200 data-[locked='false']:group-hover:translate-x-1"
          >
            <Icon data={chevron_right} size={18} />
          </span>
        )}
      </div>
    </ConditionalWrapper>
  )
}
