import { Stack } from '../index'

type SkeletonWrapperProps = {
  condition: boolean
  children: React.ReactNode
  height?: string
  width?: string
  type: 'text' | 'textfield' | 'box'
}
export const SkeletonWrapper = (props: SkeletonWrapperProps) => {
  const { condition, children, height = '1rem', width = '100%', type } = props

  if (type === 'textfield') {
    return condition ? (
      children
    ) : (
      <Stack $spacing={0.25}>
        <div className="bg-(--bg-medium) rounded animate-pulse" style={{ width: '125px', height: '0.875rem' }} />
        <div className="bg-(--bg-medium) rounded animate-pulse" style={{ width: '100%', height: '2.5rem' }} />
      </Stack>
    )
  }

  return condition ? children : <div className="bg-(--bg-medium) rounded" style={{ width, height }} />
}
