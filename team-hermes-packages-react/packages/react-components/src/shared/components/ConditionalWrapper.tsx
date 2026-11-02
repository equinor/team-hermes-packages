export function ConditionalWrapper(props: {
  children: React.ReactNode
  condition: boolean
  wrapper: any
}): React.ReactNode {
  const { condition, wrapper, children } = props
  return condition ? wrapper(children) : children
}
