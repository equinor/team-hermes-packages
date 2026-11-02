import { type IconData, lock } from '@equinor/eds-icons'
import { Chip, IconContainer } from '@/components'
import type { Theme } from '@/shared/types'
import { ConditionalWrapper } from '@/shared/components/ConditionalWrapper'

type QuickAccessButtonProps = {
  /** EDS icon displayed in the circular icon container. */
  icon: IconData
  /** Primary text displayed below the icon. */
  label: string
  /** Secondary text below the label. */
  description?: string
  /** Navigation target URL. */
  linkTo?: string
  /** Color theme for the icon container. */
  variant?: Theme
  /** When true, disables interaction and shows a lock chip. */
  locked?: boolean
  /** Text shown in the lock chip when locked. Defaults to "No access". */
  lockedReason?: string
  /** Router-aware link component. Falls back to a plain `<a>` tag. */
  LinkComponent?: React.ComponentType<React.ComponentProps<'a'> & { to: string }>
}

export function QuickAccessButton(props: QuickAccessButtonProps) {
  const { icon, label, description, linkTo, variant = 'accent', locked = false, lockedReason, LinkComponent } = props

  return (
    <ConditionalWrapper
      condition={!!linkTo && !locked}
      wrapper={(children: React.ReactNode) =>
        LinkComponent ? (
          <LinkComponent to={linkTo || ''} style={{ display: 'flex', textDecoration: 'none', color: 'inherit' }}>
            {children}
          </LinkComponent>
        ) : (
          <a href={linkTo || ''} style={{ display: 'flex', textDecoration: 'none', color: 'inherit' }}>
            {children}
          </a>
        )
      }
    >
      <div
        className="flex flex-col items-center gap-3 bg-surface shadow-(--box-elevation) rounded px-4 py-6 grow transition-[box-shadow,transform] duration-200 data-[locked=false]:hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)] data-[locked=false]:hover:-translate-y-0.5 data-[locked=true]:cursor-not-allowed data-[locked=true]:opacity-55"
        data-locked={locked}
      >
        <IconContainer icon={icon} iconSize={24} size={56} shape="circle" variant={variant} />
        <div className="flex flex-col text-center">
          <span className="font-bold block">{label}</span>
          <span className="text-meta">{description}</span>
        </div>
        {locked && (
          <Chip theme="neutral" fontSize="xs" icon={lock}>
            {lockedReason || 'No access'}
          </Chip>
        )}
      </div>
    </ConditionalWrapper>
  )
}
