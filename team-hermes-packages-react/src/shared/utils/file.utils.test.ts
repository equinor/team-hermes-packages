import { describe, expect, it } from 'vite-plus/test'
import { formatFileSize, isAcceptedFileType } from './file.utils'

const file = (name: string, type: string) => new File(['x'], name, { type })

describe('isAcceptedFileType', () => {
  it('accepts anything when accept is empty or undefined', () => {
    expect(isAcceptedFileType(file('a.exe', 'application/x-msdownload'))).toBe(true)
    expect(isAcceptedFileType(file('a.exe', ''), '')).toBe(true)
    expect(isAcceptedFileType(file('a.exe', ''), ' , ')).toBe(true)
  })

  it('matches extensions case-insensitively', () => {
    expect(isAcceptedFileType(file('Doc.PDF', 'application/pdf'), '.pdf')).toBe(true)
    expect(isAcceptedFileType(file('doc.txt', 'text/plain'), '.pdf')).toBe(false)
  })

  it('matches exact MIME types', () => {
    expect(isAcceptedFileType(file('a.png', 'image/png'), 'image/png')).toBe(true)
    expect(isAcceptedFileType(file('a.jpg', 'image/jpeg'), 'image/png')).toBe(false)
  })

  it('matches wildcard MIME types', () => {
    expect(isAcceptedFileType(file('a.png', 'image/png'), 'image/*')).toBe(true)
    expect(isAcceptedFileType(file('a.mp4', 'video/mp4'), 'image/*')).toBe(false)
  })

  it('handles comma separated lists with whitespace', () => {
    const accept = 'image/*, .pdf ,application/json'
    expect(isAcceptedFileType(file('a.pdf', ''), accept)).toBe(true)
    expect(isAcceptedFileType(file('a.json', 'application/json'), accept)).toBe(true)
    expect(isAcceptedFileType(file('a.gif', 'image/gif'), accept)).toBe(true)
    expect(isAcceptedFileType(file('a.zip', 'application/zip'), accept)).toBe(false)
  })
})

describe('formatFileSize', () => {
  it('formats bytes below 1 MB as KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(512)).toBe('0.5 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats bytes at or above 1 MB as MB', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB')
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10.0 MB')
  })

  it('formats 0 bytes as KB', () => {
    expect(formatFileSize(0)).toBe('0.0 KB')
  })
})
