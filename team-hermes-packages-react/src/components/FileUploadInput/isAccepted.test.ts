import { describe, expect, it } from 'vite-plus/test'
import { isAccepted } from './isAccepted'

const file = (name: string, type: string) => new File(['x'], name, { type })

describe('isAccepted', () => {
  it('accepts anything when accept is empty or undefined', () => {
    expect(isAccepted(file('a.exe', 'application/x-msdownload'))).toBe(true)
    expect(isAccepted(file('a.exe', ''), '')).toBe(true)
    expect(isAccepted(file('a.exe', ''), ' , ')).toBe(true)
  })

  it('matches extensions case-insensitively', () => {
    expect(isAccepted(file('Doc.PDF', 'application/pdf'), '.pdf')).toBe(true)
    expect(isAccepted(file('doc.txt', 'text/plain'), '.pdf')).toBe(false)
  })

  it('matches exact MIME types', () => {
    expect(isAccepted(file('a.png', 'image/png'), 'image/png')).toBe(true)
    expect(isAccepted(file('a.jpg', 'image/jpeg'), 'image/png')).toBe(false)
  })

  it('matches wildcard MIME types', () => {
    expect(isAccepted(file('a.png', 'image/png'), 'image/*')).toBe(true)
    expect(isAccepted(file('a.mp4', 'video/mp4'), 'image/*')).toBe(false)
  })

  it('handles comma separated lists with whitespace', () => {
    const accept = 'image/*, .pdf ,application/json'
    expect(isAccepted(file('a.pdf', ''), accept)).toBe(true)
    expect(isAccepted(file('a.json', 'application/json'), accept)).toBe(true)
    expect(isAccepted(file('a.gif', 'image/gif'), accept)).toBe(true)
    expect(isAccepted(file('a.zip', 'application/zip'), accept)).toBe(false)
  })
})
