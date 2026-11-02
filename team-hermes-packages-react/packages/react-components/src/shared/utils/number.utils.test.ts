import { describe, expect, it } from 'vite-plus/test'
import { formatNumberToLocale } from './number.utils'

describe('formatNumberToLocale', () => {
  it('returns empty string for null or undefined', () => {
    expect(formatNumberToLocale(null)).toBe('')
    expect(formatNumberToLocale(undefined)).toBe('')
  })

  it('formats integers with space as thousand separator', () => {
    expect(formatNumberToLocale(1000)).toBe('1 000')
    expect(formatNumberToLocale(1000000)).toBe('1 000 000')
  })

  it('rounds to whole numbers by default', () => {
    expect(formatNumberToLocale(1234.56)).toBe('1 235')
  })

  it('respects the decimals parameter', () => {
    expect(formatNumberToLocale(1234.56, 2)).toBe('1 234.56')
    expect(formatNumberToLocale(1000, 1)).toBe('1 000.0')
  })

  it('returns small numbers without separators', () => {
    expect(formatNumberToLocale(42)).toBe('42')
  })
})
