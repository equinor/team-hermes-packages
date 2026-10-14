import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { useFinderPagination } from './useFinderPagination'

describe('useFinderPagination', () => {
  it('defaults to a page size of 100', () => {
    const { result } = renderHook(() => useFinderPagination(), { wrapper: withNuqsTestingAdapter() })
    expect(result.current.pagination).toEqual({ pageIndex: 0, pageSize: 100 })
  })

  it('passes options through to useUrlPagination', () => {
    const { result } = renderHook(() => useFinderPagination({ defaultPageSize: 10, defaultPageIndex: 2 }), {
      wrapper: withNuqsTestingAdapter(),
    })
    expect(result.current.pagination).toEqual({ pageIndex: 2, pageSize: 10 })
  })

  it('applies the prefix to URL params', () => {
    const { result } = renderHook(() => useFinderPagination({ prefix: 'w' }), {
      wrapper: withNuqsTestingAdapter({ searchParams: { w_page: '3', w_per_page: '20' } }),
    })
    expect(result.current.pagination).toEqual({ pageIndex: 3, pageSize: 20 })
  })
})
