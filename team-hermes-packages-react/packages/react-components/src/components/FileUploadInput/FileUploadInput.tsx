import { Icon } from '@equinor/eds-core-react'
import { upload } from '@equinor/eds-icons'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isAcceptedFileType } from '../../shared/utils/file.utils'

export interface FileUploadProps {
  /** Callback function invoked when the selected files change */
  onFileChange: (files: File[]) => void
  /** Callback function invoked with files that do not match `accept` (from both picker and drop) */
  onRejectedFileChange?: (files: File[]) => void
  /** Whether multiple files can be selected */
  multiple?: boolean
  /** Optional string specifying the accepted file types, e.g., "image/*" */
  accept?: string
  /** Optional human-readable string describing the accepted file types */
  acceptString?: string
}

export type DropState = 'idle' | 'potentialDrop' | 'overTarget'

export const FileUploadInput = ({
  onFileChange,
  onRejectedFileChange,
  accept,
  multiple,
  acceptString,
}: FileUploadProps) => {
  const [dropState, setDropState] = useState<DropState>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)
  const windowDragCounterRef = useRef(0)

  // Window-level listener to detect when files enter/leave the browser
  useEffect(() => {
    const handleWindowDragEnter = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) {
        windowDragCounterRef.current++
        setDropState((prev) => (prev === 'overTarget' ? prev : 'potentialDrop'))
      }
    }
    const handleWindowDragLeave = () => {
      windowDragCounterRef.current--
      if (windowDragCounterRef.current === 0) {
        setDropState('idle')
      }
    }
    const handleWindowDrop = () => {
      windowDragCounterRef.current = 0
    }

    window.addEventListener('dragenter', handleWindowDragEnter)
    window.addEventListener('dragleave', handleWindowDragLeave)
    window.addEventListener('drop', handleWindowDrop)
    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter)
      window.removeEventListener('dragleave', handleWindowDragLeave)
      window.removeEventListener('drop', handleWindowDrop)
    }
  }, [])

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    dragCounterRef.current++
    if (event.dataTransfer.types.includes('Files')) {
      setDropState('overTarget')
    }
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setDropState('potentialDrop')
    }
  }, [])

  // Some platforms (e.g. Windows) let users pick files outside `accept`, so validate manually
  const processFiles = useCallback(
    (incoming: File[]) => {
      const accepted: File[] = []
      const rejected: File[] = []
      for (const file of incoming) {
        if (isAcceptedFileType(file, accept)) accepted.push(file)
        else rejected.push(file)
      }
      const files = multiple ? accepted : accepted.slice(0, 1)
      if (files.length > 0) onFileChange(files)
      if (rejected.length > 0) onRejectedFileChange?.(rejected)
    },
    [onFileChange, onRejectedFileChange, accept, multiple]
  )

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      dragCounterRef.current = 0
      setDropState('idle')
      processFiles(Array.from(event.dataTransfer.files))
    },
    [processFiles]
  )

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(event.currentTarget.files ?? []))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col items-center justify-center gap-2 p-8 sticky top-0 z-1 bg-surface border-2 border-dashed border-theme-accent-fg rounded data-[drop-state=potentialDrop]:border-solid data-[drop-state=overTarget]:opacity-70"
      data-drop-state={dropState}
    >
      <Icon data={upload} size={32} color="var(--color-theme-accent-fg)" />
      <span className="text-center">
        <button
          className="font-bold text-theme-accent-fg underline hover:opacity-70"
          onClick={() => fileInputRef.current?.click()}
        >
          Click here to select file(s)
        </button>{' '}
        or drop here <br /> ({acceptString ?? accept})
      </span>
      <input
        accept={accept}
        ref={fileInputRef}
        multiple={multiple}
        className="sr-only"
        type="file"
        onChange={handleFileChange}
      />
    </div>
  )
}
