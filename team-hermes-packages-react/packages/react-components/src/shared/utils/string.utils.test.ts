import { describe, expect, it } from 'vite-plus/test'
import { generateSlug, pluralize } from './string.utils'

describe('pluralize', () => {
  it('returns the singular form when count is 1', () => {
    expect(pluralize('item', 1)).toBe('item')
  })

  it('appends "s" when count is 0', () => {
    expect(pluralize('item', 0)).toBe('items')
  })

  it('appends "s" when count is greater than 1', () => {
    expect(pluralize('item', 5)).toBe('items')
  })

  it('appends "s" for negative counts', () => {
    expect(pluralize('item', -1)).toBe('items')
  })
})

describe('generateSlug', () => {
  it('converts a simple string to lowercase with hyphens', () => {
    expect(generateSlug('Hello World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(generateSlug('Hello, World!')).toBe('hello-world')
  })

  it('collapses multiple spaces into a single hyphen', () => {
    expect(generateSlug('hello   world')).toBe('hello-world')
  })

  it('collapses multiple hyphens into a single hyphen', () => {
    expect(generateSlug('hello---world')).toBe('hello-world')
  })

  it('trims whitespace', () => {
    expect(generateSlug('  hello world  ')).toBe('hello-world')
  })

  it('handles strings with only special characters', () => {
    expect(generateSlug('!@#$%')).toBe('')
  })
})
