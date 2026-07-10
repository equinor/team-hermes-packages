import type { Theme } from '@/shared/types'
import type { IconData } from '@equinor/eds-icons'
import { Icon } from '@equinor/eds-core-react'
import { chevron_right } from '@equinor/eds-icons'
import { IconContainer } from '@/components'

export type NavLinkType = {
  href: string
  title: string
  description: string
  icon: IconData
  variant?: Theme
  /**
   * Optional access predicate. If omitted, the link is always visible.
   * Return `'loading'` to delay rendering until the user data resolves.
   */
  canAccess?: (hasPermission: any) => boolean | 'loading'
}

export function NavListItem({
  item,
  LinkComponent,
}: {
  item: NavLinkType
  LinkComponent: React.ComponentType<React.ComponentProps<'a'> & { to: string }>
}) {
  const variant = item.variant ?? 'success'
  return (
    <li className="p-2">
      <LinkComponent
        to={item.href}
        className="group flex items-center gap-4 px-5 py-3 duration-150 hover:bg-surface-hover rounded [.active]:opacity-50"
      >
        <IconContainer variant={variant} icon={item.icon} size={48} iconSize={18} />
        <span className="flex-1 min-w-0">
          <span className="block font-medium">{item.title}</span>
          <span className="block text-meta mt-0.5 max-w-80">{item.description}</span>
        </span>
        <span className="shrink-0 transition-transform duration-200 group-hover:translate-x-1">
          <Icon data={chevron_right} size={18} />
        </span>
      </LinkComponent>
    </li>
  )
}
