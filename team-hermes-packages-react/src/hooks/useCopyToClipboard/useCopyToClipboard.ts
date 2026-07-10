import { useState } from 'react'

/**
 * useCopyToClipboard is a custom React hook that provides functionality to copy text to the clipboard.
 * It maintains the state of the copied text and whether the copy operation was successful.
 * @returns An object containing the copied text, a boolean indicating if the text was copied, and a function to copy text to the clipboard.
 */

type UseCopyToClipboardReturn = {
  _copiedText: string
  isCopied: boolean
  copy: (text: string) => Promise<void>
}

type UseCopyToClipboardOptions = {
  resetTimeout?: number // Optional timeout duration in milliseconds to reset the isCopied state
  onError?: (error: unknown) => void // Optional callback invoked when the copy operation fails
}

export const useCopyToClipboard = (options?: UseCopyToClipboardOptions): UseCopyToClipboardReturn => {
  const { resetTimeout = 1000, onError } = options || {}
  const [_copiedText, setCopiedText] = useState('')
  const [isCopied, setIsCopied] = useState(false)

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), resetTimeout) // Reset after the specified timeout
    } catch (error) {
      console.error('Failed to copy text to clipboard:', error)
      setIsCopied(false)
      onError?.(error)
    }
  }

  return { _copiedText, copy, isCopied }
}
