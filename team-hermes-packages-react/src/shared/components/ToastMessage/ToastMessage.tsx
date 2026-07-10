import type { ToastContentProps } from 'react-toastify'
import { Message } from '@/components'
import type { Theme } from '@/shared/types'

type ToastMessageProps = ToastContentProps<{
  title: string
  details: string
  type: Theme
}>

export function ToastMessage(props: ToastMessageProps) {
  const { data, closeToast } = props
  const { title, details, type } = data

  return (
    <Message type={type} title={title} onDismiss={closeToast} style={{ maxWidth: '100vw' }}>
      <span>{details}</span>
    </Message>
  )
}
