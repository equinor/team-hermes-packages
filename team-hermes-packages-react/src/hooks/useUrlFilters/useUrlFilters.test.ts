import { FilterOperator } from '@team-hermes/react-components'
import { act, renderHook } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { describe, expect, it, vi } from 'vitest'
import { useUrlFilters } from './useUrlFilters'

const wrapperWith = (searchParams: string = '') => withNuqsTestingAdapter({ searchParams, hasMemory: true })

describe('useUrlFilters', () => {
  it('starts empty when no URL param is present', () => {
    const { result } = renderHook(() => useUrlFilters(), { wrapper: wrapperWith() })

    expect(result.current.filters).toEqual([])
  })

  it('hydrates from the URL on mount', () => {
    const { result } = renderHook(() => useUrlFilters(), {
      wrapper: wrapperWith('?filters=review_status*eq*DRAFT,IN_REVIEW'),
    })

    expect(result.current.filters).toEqual([
      { id: 'review_status', value: [{ operator: FilterOperator.eq, properties: ['DRAFT', 'IN_REVIEW'] }] },
    ])
  })

  it('addFilterValue creates the column and appends properties', () => {
    const { result } = renderHook(() => useUrlFilters(), { wrapper: wrapperWith() })

    act(() => {
      void result.current.addFilterValue('review_status', FilterOperator.eq, 'DRAFT')
    })
    act(() => {
      void result.current.addFilterValue('review_status', FilterOperator.eq, 'IN_REVIEW')
    })

    expect(result.current.filters).toEqual([
      { id: 'review_status', value: [{ operator: FilterOperator.eq, properties: ['DRAFT', 'IN_REVIEW'] }] },
    ])
  })

  it('addFilterValue is a no-op when the value already exists', () => {
    const { result } = renderHook(() => useUrlFilters(), {
      wrapper: wrapperWith('?filters=review_status*eq*DRAFT'),
    })

    act(() => {
      void result.current.addFilterValue('review_status', FilterOperator.eq, 'DRAFT')
    })

    expect(result.current.filters).toEqual([
      { id: 'review_status', value: [{ operator: FilterOperator.eq, properties: ['DRAFT'] }] },
    ])
  })

  it('removeFilterValue drops the property and prunes empty columns', () => {
    const { result } = renderHook(() => useUrlFilters(), {
      wrapper: wrapperWith('?filters=review_status*eq*DRAFT'),
    })

    act(() => {
      void result.current.removeFilterValue('review_status', FilterOperator.eq, 'DRAFT')
    })

    expect(result.current.filters).toEqual([])
  })

  it('removeFilterValue keeps siblings on the same operator', () => {
    const { result } = renderHook(() => useUrlFilters(), {
      wrapper: wrapperWith('?filters=review_status*eq*DRAFT,IN_REVIEW'),
    })

    act(() => {
      void result.current.removeFilterValue('review_status', FilterOperator.eq, 'DRAFT')
    })

    expect(result.current.filters).toEqual([
      { id: 'review_status', value: [{ operator: FilterOperator.eq, properties: ['IN_REVIEW'] }] },
    ])
  })

  it('toggleFilterValue adds then removes on a second call', () => {
    const { result } = renderHook(() => useUrlFilters(), { wrapper: wrapperWith() })

    act(() => {
      void result.current.toggleFilterValue('review_status', FilterOperator.eq, 'DRAFT')
    })
    expect(result.current.filters).toEqual([
      { id: 'review_status', value: [{ operator: FilterOperator.eq, properties: ['DRAFT'] }] },
    ])

    act(() => {
      void result.current.toggleFilterValue('review_status', FilterOperator.eq, 'DRAFT')
    })
    expect(result.current.filters).toEqual([])
  })

  it('updateFilterValue swaps operator + value while preserving other columns', () => {
    const { result } = renderHook(() => useUrlFilters(), {
      wrapper: wrapperWith('?filters=review_status*eq*DRAFT;submitted_by*ilike*Ola'),
    })

    act(() => {
      void result.current.updateFilterValue(
        'review_status',
        { operator: FilterOperator.eq, value: 'DRAFT' },
        { operator: FilterOperator.neq, value: 'APPROVED' }
      )
    })

    expect(result.current.filters).toEqual([
      { id: 'review_status', value: [{ operator: FilterOperator.neq, properties: ['APPROVED'] }] },
      { id: 'submitted_by', value: [{ operator: FilterOperator.ilike, properties: ['Ola'] }] },
    ])
  })

  it('resetFilters clears everything', () => {
    const { result } = renderHook(() => useUrlFilters(), {
      wrapper: wrapperWith('?filters=review_status*eq*DRAFT'),
    })

    act(() => {
      void result.current.resetFilters()
    })

    expect(result.current.filters).toEqual([])
  })

  it('getFilterValue returns the full FilterValue or a single operator entry', () => {
    // '+' would be decoded as a space by URLSearchParams, so escape the sub-filter separator.
    const { result } = renderHook(() => useUrlFilters(), {
      wrapper: wrapperWith('?filters=review_status*eq*DRAFT%2Bilike*rev'),
    })

    expect(result.current.getFilterValue('review_status')).toEqual([
      { operator: FilterOperator.eq, properties: ['DRAFT'] },
      { operator: FilterOperator.ilike, properties: ['rev'] },
    ])
    expect(result.current.getFilterValue('review_status', FilterOperator.ilike)).toEqual({
      operator: FilterOperator.ilike,
      properties: ['rev'],
    })
    expect(result.current.getFilterValue('missing_column')).toBeUndefined()
  })

  it('hasFilterValue reports whether a property is present for an operator', () => {
    const { result } = renderHook(() => useUrlFilters(), {
      wrapper: wrapperWith('?filters=review_status*eq*DRAFT,IN_REVIEW'),
    })

    expect(result.current.hasFilterValue('review_status', FilterOperator.eq, 'DRAFT')).toBe(true)
    expect(result.current.hasFilterValue('review_status', FilterOperator.eq, 'REJECTED')).toBe(false)
    expect(result.current.hasFilterValue('review_status', FilterOperator.neq, 'DRAFT')).toBe(false)
    expect(result.current.hasFilterValue('missing_column', FilterOperator.eq, 'DRAFT')).toBe(false)
  })

  it('prefix namespaces the URL param key', () => {
    // Hydrating from `?w_filters=…` (and NOT from `?filters=…`) is the observable proof the prefix took effect.
    const wrapper = withNuqsTestingAdapter({
      searchParams: '?w_filters=review_status*eq*DRAFT&filters=submitted_by*ilike*Ola',
      hasMemory: true,
    })
    const { result } = renderHook(() => useUrlFilters({ prefix: 'w' }), { wrapper })

    expect(result.current.filters).toEqual([
      { id: 'review_status', value: [{ operator: FilterOperator.eq, properties: ['DRAFT'] }] },
    ])
  })

  it('onFiltersChange fires after every mutation', () => {
    const onFiltersChange = vi.fn()
    const { result } = renderHook(() => useUrlFilters({ onFiltersChange }), { wrapper: wrapperWith() })

    act(() => {
      void result.current.addFilterValue('review_status', FilterOperator.eq, 'DRAFT')
    })
    act(() => {
      void result.current.toggleFilterValue('review_status', FilterOperator.eq, 'IN_REVIEW')
    })
    act(() => {
      void result.current.removeFilterValue('review_status', FilterOperator.eq, 'DRAFT')
    })
    act(() => {
      void result.current.resetFilters()
    })
    act(() => {
      void result.current.setFilters([])
    })

    expect(onFiltersChange).toHaveBeenCalledTimes(5)
  })

  it('setFilters accepts a functional updater', () => {
    const { result } = renderHook(() => useUrlFilters(), {
      wrapper: wrapperWith('?filters=review_status*eq*DRAFT'),
    })

    act(() => {
      void result.current.setFilters((prev) => [
        ...prev,
        { id: 'submitted_by', value: [{ operator: FilterOperator.ilike, properties: ['Ola'] }] },
      ])
    })

    expect(result.current.filters.map((f) => f.id)).toEqual(['review_status', 'submitted_by'])
  })
})
