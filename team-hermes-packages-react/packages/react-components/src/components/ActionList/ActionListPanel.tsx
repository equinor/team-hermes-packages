import { Typography } from '@equinor/eds-core-react'
import type { IconData } from '@equinor/eds-icons'
import { IconContainer } from '@/components'
import type { Theme } from '@/shared/types'

type ActionListPanelProps = {
  /** EDS icon displayed in the panel header. */
  icon: IconData
  /** Panel header title. */
  title: string
  /** Optional secondary text shown in the panel header. */
  description?: string
  /** Color theme for the header icon. */
  variant?: Theme
  /** ActionListItem elements to render inside the panel. */
  children: React.ReactNode
}

export function ActionListPanel(props: ActionListPanelProps) {
  const { icon, title, description, variant = 'accent', children } = props

  return (
    <div className="bg-surface shadow-(--box-elevation) rounded overflow-hidden flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-stroke-subtle">
        <IconContainer icon={icon} iconSize={18} size={36} variant={variant} />
        <span className="font-bold text-base">{title}</span>
        {description && (
          <Typography
            variant="caption"
            color="var(--color-secondary)"
            style={{ marginLeft: 'auto', fontWeight: '400' }}
          >
            {description}
          </Typography>
        )}
      </div>
      {children}
    </div>
  )
}
