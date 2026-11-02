import { toast } from 'react-toastify'
import { ToastMessage } from '@/shared/components/ToastMessage/ToastMessage'

export function useCustomToast() {
  const success = (message: string) => {
    toast(ToastMessage, {
      data: {
        title: 'Success',
        details: message,
        type: 'success',
      },
      autoClose: 3000,
      closeButton: false,
    })
  }

  const error = (
    title: string = 'Oh Snap!',
    message: string = 'An unexpected error occurred.',
    autoClose: number | false = 8000
  ) => {
    toast(ToastMessage, {
      data: {
        title: title,
        details: message,
        type: 'danger',
      },
      autoClose: autoClose,
      closeButton: false,
    })
  }

  const warning = (title: string, message: string, autoClose: number | false = 5000) => {
    toast(ToastMessage, {
      data: {
        title,
        details: message,
        type: 'warning',
      },
      autoClose,
      closeButton: false,
    })
  }

  const info = (title: string, message: string, autoClose: number | false = false) => {
    toast(ToastMessage, {
      data: {
        title,
        details: message,
        type: 'info',
      },
      autoClose,
      closeButton: false,
    })
  }

  return { error, success, warning, info }
}
