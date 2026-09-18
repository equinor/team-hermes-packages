import { Icon } from '@equinor/eds-core-react'
import { chevron_right, external_link, lock } from '@equinor/eds-icons'
import { Chip, IconContainer } from '@/components'
import { ConditionalWrapper } from '@/shared/components/ConditionalWrapper'
import type { NavLinkType } from '../NavBar.types'

const wrapperClassName = 'block rounded [&.active>div]:opacity-50'
const contentClassName =
  'group flex items-center gap-4 px-5 py-3 rounded transition-[background] duration-150 data-[locked="false"]:hover:bg-surface-hover data-[locked="true"]:cursor-default data-[locked="true"]:opacity-55'

export function NavListItem({
  item,
  LinkComponent,
}: {
  item: NavLinkType
  LinkComponent: React.ComponentType<React.ComponentProps<'a'> & { to: string }>
}) {
  if (item.hidden) return null

  const variant = item.variant ?? 'success'
  const { locked = false, lockedReason } = item

  return (
    <li className="p-2">
      <ConditionalWrapper
        condition={!locked}
        wrapper={(children: React.ReactNode) =>
          item.external ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={wrapperClassName}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              {children}
            </a>
          ) : (
            <LinkComponent
              to={item.href}
              className={wrapperClassName}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              {children}
            </LinkComponent>
          )
        }
      >
        <div className={contentClassName} data-locked={locked}>
          <IconContainer variant={variant} icon={item.icon} size={48} iconSize={18} />
          <span className="flex-1 min-w-0">
            <span className="block font-medium">{item.title}</span>
            <span className="block text-meta mt-0.5 max-w-80">{item.description}</span>
            {item.external && !locked && <span className="sr-only">Opens in a new tab</span>}
          </span>
          {locked ? (
            <Chip theme="neutral" fontSize="xs" icon={lock}>
              {lockedReason || 'No access'}
            </Chip>
          ) : item.external ? (
            <span className="shrink-0">
              <Icon data={external_link} size={18} />
            </span>
          ) : (
            <span className="shrink-0 transition-transform duration-200 group-hover:translate-x-1">
              <Icon data={chevron_right} size={18} />
            </span>
          )}
        </div>
      </ConditionalWrapper>
    </li>
  )
}
