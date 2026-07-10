import { Icon } from '@equinor/eds-core-react'
import { add, type IconData, minimize } from '@equinor/eds-icons'
import { useMemo, useState } from 'react'
import { IconContainer, Stack } from '@/components'
import type { Theme } from '@/shared/types'

type DataGridSidebarSectionProps = {
  label: string
  icon: IconData
  variant?: Theme
  children?: React.ReactNode
  initiallyOpen?: boolean
  minimizeContent?: boolean
  toggleContentCallback: () => void
}

export const DataGridSidebarSection = (props: DataGridSidebarSectionProps) => {
  const { label, icon, variant = 'success', minimizeContent = false, initiallyOpen = false } = props
  const [showContent, setShowContent] = useState<boolean>(initiallyOpen)

  useMemo(() => {
    if (minimizeContent) {
      setShowContent(false)
      return
    }
    setShowContent(initiallyOpen)
  }, [minimizeContent])

  const onToggleContent = () => {
    if (minimizeContent) {
      props.toggleContentCallback()
    } else {
      setShowContent(!showContent)
    }
  }

  return (
    <Stack>
      <button
        className="grid grid-cols-[2rem_1fr_auto] text-left p-2 border-b border-stroke-subtle items-center gap-2"
        aria-expanded={showContent}
        onClick={onToggleContent}
      >
        <IconContainer variant={variant} icon={icon} size={32} />
        {!minimizeContent && (
          <>
            <span>{label}</span>
            <Icon data={showContent ? minimize : add} />
          </>
        )}
      </button>
      <div className="manual-accordion-panel" aria-hidden={!showContent}>
        <div className="manual-accordion-panel-content">{props.children}</div>
      </div>
    </Stack>
  )
}
