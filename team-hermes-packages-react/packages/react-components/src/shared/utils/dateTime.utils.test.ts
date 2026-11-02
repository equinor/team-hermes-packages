import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isWithinLastHours, timeAgo } from './dateTime.utils'

describe('isWithinLastHours', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true when the date is within the threshold', () => {
    expect(isWithinLastHours('2026-06-11T11:30:00', 1)).toBe(true)
  })

  it('returns false when the date is older than the threshold', () => {
    expect(isWithinLastHours('2026-06-11T10:59:59', 1)).toBe(false)
  })

  it('returns false when the date is in the future', () => {
    expect(isWithinLastHours('2026-06-11T12:00:01', 1)).toBe(false)
  })

  it('handles dates with an explicit timezone suffix', () => {
    expect(isWithinLastHours('2026-06-11T11:30:00Z', 1)).toBe(true)
  })
})

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('handles dates with an explicit timezone suffix', () => {
    expect(timeAgo('2026-06-11T11:30:00Z')).toBe('30 minutes ago')
  })
})
