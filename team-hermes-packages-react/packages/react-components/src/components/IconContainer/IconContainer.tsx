import { Icon, Progress } from '@equinor/eds-core-react'
import type { IconData } from '@equinor/eds-icons'
import type { Theme } from '../../shared/types/themes.type'

type IconContainerProps = {
  icon?: IconData | null
  text?: string | number
  iconSize?: 18 | 16 | 24 | 32 | 48 | undefined
  size?: number
  shape?: 'rounded' | 'circle'
  variant?: Theme
  loading?: boolean
  loadingSize?: 16 | 24 | 32 | 48 | undefined
  ref?: React.Ref<HTMLDivElement>
}

export function IconContainer(props: IconContainerProps) {
  const {
    icon,
    iconSize = 18,
    size = 48,
    shape = 'rounded',
    variant = 'accent',
    loading,
    loadingSize = 24,
    text,
    ref,
  } = props

  const doubleContent = !!(icon && (text || text === 0))

  return (
    <div
      ref={ref}
      className="flex items-center gap-2 justify-center shrink-0 bg-[color-mix(in_oklab,var(--eds-color-border-subtle)_30%,transparent)]"
      data-color-appearance={variant}
      style={{
        width: doubleContent ? size * 2 : size,
        height: size,
        borderRadius: shape === 'circle' ? '50%' : '0.5rem',
      }}
    >
      {loading && <Progress.Circular size={loadingSize} />}
      {!loading && icon && (
        <Icon
          data={icon}
          size={iconSize}
          className="shrink-0"
          data-color-appearance={variant}
          color={`var(--eds-color-bg-fill-emphasis-default)`}
        />
      )}
      {!loading && (text || text === 0) && (
        <span data-color-appearance={variant} className={`text-overline text-(--eds-color-bg-fill-emphasis-default)`}>
          {text}
        </span>
      )}
    </div>
  )
}
