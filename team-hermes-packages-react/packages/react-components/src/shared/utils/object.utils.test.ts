import { describe, expect, it } from 'vite-plus/test'
import { deepSet, deleteByPath, getNestedValue } from './object.utils'

describe('deepSet', () => {
  it('sets a top-level property', () => {
    const obj: any = {}
    deepSet(obj, 'a', 1)
    expect(obj.a).toBe(1)
  })

  it('sets a nested property', () => {
    const obj: any = {}
    deepSet(obj, 'a.b.c', 42)
    expect(obj.a.b.c).toBe(42)
  })

  it('sets a value using bracket notation for arrays', () => {
    const obj: any = {}
    deepSet(obj, 'a[0]', 'first')
    expect(obj.a[0]).toBe('first')
  })

  it('sets a deeply nested value with mixed dot and bracket notation', () => {
    const obj: any = {}
    deepSet(obj, 'a[0].b.c', 'deep')
    expect(obj.a[0].b.c).toBe('deep')
  })

  it('preserves existing sibling properties', () => {
    const obj: any = { a: { x: 1 } }
    deepSet(obj, 'a.y', 2)
    expect(obj.a.x).toBe(1)
    expect(obj.a.y).toBe(2)
  })
})

describe('deleteByPath', () => {
  it('deletes a top-level property', () => {
    const obj = { a: 1, b: 2 }
    expect(deleteByPath(obj, 'a')).toBe(true)
    expect(obj).toEqual({ b: 2 })
  })

  it('deletes a nested property', () => {
    const obj = { a: { b: { c: 3 } } }
    expect(deleteByPath(obj, 'a.b.c')).toBe(true)
    expect(obj.a.b).toEqual({})
  })

  it('deletes using bracket notation', () => {
    const obj = { a: [10, 20, 30] }
    expect(deleteByPath(obj, 'a[1]')).toBe(true)
    expect(1 in obj.a).toBe(false)
  })

  it('returns false for non-existent paths', () => {
    expect(deleteByPath({ a: 1 }, 'b.c')).toBe(false)
  })

  it('returns false for non-object inputs', () => {
    expect(deleteByPath(null, 'a')).toBe(false)
    expect(deleteByPath(42 as any, 'a')).toBe(false)
  })

  it('returns false for empty or whitespace paths', () => {
    expect(deleteByPath({}, '')).toBe(false)
    expect(deleteByPath({}, '  ')).toBe(false)
  })
})

describe('getNestedValue', () => {
  it('retrieves a top-level value', () => {
    expect(getNestedValue({ a: 1 }, 'a')).toBe(1)
  })

  it('retrieves a nested value', () => {
    expect(getNestedValue({ a: { b: { c: 3 } } }, 'a.b.c')).toBe(3)
  })

  it('returns the default value for missing paths', () => {
    expect(getNestedValue({ a: 1 }, 'b.c')).toBeNull()
    expect(getNestedValue({ a: 1 }, 'b.c', 'fallback')).toBe('fallback')
  })

  it('returns the value even if falsy', () => {
    expect(getNestedValue({ a: { b: 0 } }, 'a.b')).toBe(0)
    expect(getNestedValue({ a: { b: '' } }, 'a.b')).toBe('')
    expect(getNestedValue({ a: { b: false } }, 'a.b')).toBe(false)
  })

  it('returns default when intermediate key is missing', () => {
    expect(getNestedValue({ a: {} }, 'a.b.c', 'default')).toBe('default')
  })
})
