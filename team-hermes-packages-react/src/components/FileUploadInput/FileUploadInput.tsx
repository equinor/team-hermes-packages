import { Icon } from '@equinor/eds-core-react'
import { upload } from '@equinor/eds-icons'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface FileUploadProps {
  onFileChange: (files: File[]) => void
  multiple?: boolean
  accept?: string
}

export type DropState = 'idle' | 'potentialDrop' | 'overTarget'

export const FileUploadInput = ({ onFileChange, accept, multiple }: FileUploadProps) => {
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

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      dragCounterRef.current = 0
      setDropState('idle')
      const files = Array.from(event.dataTransfer.files)
      if (files.length > 0) onFileChange(files)
    },
    [onFileChange]
  )

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    if (files) onFileChange(files)
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
        or drop here <br /> ({accept})
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
