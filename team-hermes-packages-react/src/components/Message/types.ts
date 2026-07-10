import {
  check_circle_outlined,
  error_outlined,
  type IconData,
  info_circle,
  warning_outlined,
} from '@equinor/eds-icons'
import type { Theme } from '@/shared/types'

export type MessageProps = {
  children?: React.ReactNode
  title?: string
  iconPosition?: 'start' | 'end' | 'none'
  iconSize?: 16 | 18 | 24 | 32 | 48
  iconOverride?: IconData
  onDismiss?: () => void
  type?: Theme
  fullWidth?: boolean
} & React.HTMLAttributes<HTMLDivElement>

export const ICON_TYPES: { [key in Theme]: IconData } = {
  success: check_circle_outlined,
  danger: error_outlined,
  warning: warning_outlined,
  info: info_circle,
  accent: info_circle,
  neutral: info_circle,
}
