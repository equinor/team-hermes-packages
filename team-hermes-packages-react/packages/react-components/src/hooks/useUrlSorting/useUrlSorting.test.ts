import { act, renderHook } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useUrlSorting } from './useUrlSorting'

const wrapperWith = (searchParams: string = '') => withNuqsTestingAdapter({ searchParams, hasMemory: true })

describe('useUrlSorting', () => {
  it('starts unsorted when no URL params or defaults are provided', () => {
    const { result } = renderHook(() => useUrlSorting(), { wrapper: wrapperWith() })

    expect(result.current.sorting).toEqual([])
  })

  it('uses default sort column and order when URL params are absent', () => {
    const { result } = renderHook(() => useUrlSorting({ defaultSortColumn: 'created_at', defaultSortOrder: 'desc' }), {
      wrapper: wrapperWith(),
    })

    expect(result.current.sorting).toEqual([{ id: 'created_at', desc: true }])
  })

  it('hydrates sorting from the URL, taking precedence over defaults', () => {
    const { result } = renderHook(() => useUrlSorting({ defaultSortColumn: 'created_at', defaultSortOrder: 'asc' }), {
      wrapper: wrapperWith('?sort_by=name&sort_order=desc'),
    })

    expect(result.current.sorting).toEqual([{ id: 'name', desc: true }])
  })

  it('setSorting updates the URL-backed state', () => {
    const { result } = renderHook(() => useUrlSorting(), { wrapper: wrapperWith() })

    act(() => {
      result.current.setSorting([{ id: 'name', desc: true }])
    })

    expect(result.current.sorting).toEqual([{ id: 'name', desc: true }])
  })

  it('setSorting accepts a functional updater', () => {
    const { result } = renderHook(() => useUrlSorting(), {
      wrapper: wrapperWith('?sort_by=created_at&sort_order=asc'),
    })

    act(() => {
      result.current.setSorting((current) => current.map((sort) => ({ ...sort, desc: true })))
    })

    expect(result.current.sorting).toEqual([{ id: 'created_at', desc: true }])
  })

  it('clears sorting when the next state is empty', () => {
    const { result } = renderHook(() => useUrlSorting(), {
      wrapper: wrapperWith('?sort_by=created_at&sort_order=desc'),
    })

    act(() => {
      result.current.setSorting([])
    })

    expect(result.current.sorting).toEqual([])
  })

  it('calls onSortChange after each update', () => {
    const onSortChange = vi.fn()
    const { result } = renderHook(() => useUrlSorting({ onSortChange }), { wrapper: wrapperWith() })

    act(() => {
      result.current.setSorting([{ id: 'name', desc: false }])
    })
    act(() => {
      result.current.setSorting([])
    })

    expect(onSortChange).toHaveBeenCalledTimes(2)
  })
})
