import type { CSSProperties } from 'react'
import { defaultProps, type SpacingType, type StackProps } from './types'

const formatSpacing = (value: SpacingType | undefined): string | undefined => {
  if (value === undefined) return undefined
  if (Array.isArray(value)) return value.map((v) => `${v}rem`).join(' ')
  return `${value}rem`
}

export const Stack = ({
  $spacing,
  $inline,
  $alignContent,
  $alignItems,
  $alignSelf,
  $justifyContent,
  $grow,
  $shrink,
  $direction,
  $wrap,
  $padding,
  $margin,
  $fullWidth,
  $fullHeight,
  $position,
  $minHeight,
  $scrollY,
  $scrollX,
  as,
  style,
  ...rest
}: StackProps) => {
  const Component = (as ?? 'div') as 'div'
  const userProps = {
    $spacing,
    $inline,
    $alignContent,
    $alignItems,
    $alignSelf,
    $justifyContent,
    $grow,
    $shrink,
    $direction,
    $wrap,
    $padding,
    $margin,
    $fullWidth,
    $fullHeight,
    $position,
    $minHeight,
    $scrollY,
    $scrollX,
  }
  const props = {
    ...defaultProps,
    ...Object.fromEntries(Object.entries(userProps).filter(([, v]) => v !== undefined)),
  } as typeof userProps

  const stackStyle: CSSProperties = {
    display: props.$inline ? 'inline-flex' : 'flex',
    flexDirection: props.$direction,
    flexGrow: props.$grow,
    flexShrink: props.$shrink,
    flexWrap: props.$wrap === 'no-wrap' ? 'nowrap' : (props.$wrap as CSSProperties['flexWrap']),
    minHeight: props.$minHeight !== undefined ? `${props.$minHeight}px` : undefined,
    position: props.$position,
    width: props.$fullWidth ? '100%' : undefined,
    height: props.$fullHeight ? '100%' : undefined,
    overflowY: props.$scrollY ? 'auto' : undefined,
    overflowX: props.$scrollX ? 'auto' : undefined,
    alignItems: props.$alignItems,
    alignContent: props.$alignContent,
    alignSelf: props.$alignSelf,
    justifyContent: props.$justifyContent,
    gap: props.$spacing !== undefined ? `${props.$spacing}rem` : undefined,
    padding: formatSpacing(props.$padding),
    margin: formatSpacing(props.$margin),
    ...style,
  }

  return <Component {...rest} style={stackStyle} />
}
