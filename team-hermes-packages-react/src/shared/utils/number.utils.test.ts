import { describe, expect, it } from 'vite-plus/test'
import { formatFileSize, formatNumberToLocale } from './number.utils'

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
