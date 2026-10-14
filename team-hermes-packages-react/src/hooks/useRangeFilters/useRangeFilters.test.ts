import { act, renderHook, waitFor } from '@testing-library/react'
import { type UrlUpdateEvent, withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useRangeFilters } from './useRangeFilters'

function renderFilters(searchParams = '') {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()
  return {
    ...renderHook(useRangeFilters, {
      wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate, hasMemory: true }),
    }),
    onUrlUpdate,
  }
}

describe('range updates', () => {
  it('reads canonical URLs and preserves other ranges on edit', async () => {
    const { result, onUrlUpdate } = renderFilters(
      '?ranges=numeric_measurements.porosity:1~10,numeric_measurements.density:2~'
    )
    expect(result.current.rangeFilters).toEqual({
      'numeric_measurements.porosity': { from: '1', to: '10' },
      'numeric_measurements.density': { from: '2', to: '' },
    })
    expect(onUrlUpdate).not.toHaveBeenCalled()
    act(() => result.current.addRangeFilters([{ attribute: 'numeric_measurements.porosity', from: 0 }]))
    expect(result.current.rangeFilters).toEqual({
      'numeric_measurements.porosity': { from: 0 },
      'numeric_measurements.density': { from: '2', to: '' },
    })
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledTimes(1))
    const { searchParams } = onUrlUpdate.mock.calls[0][0]
    expect([...searchParams.keys()]).toEqual(['ranges'])
    expect(searchParams.get('ranges')).toBe('numeric_measurements.porosity:0~,numeric_measurements.density:2~')
  })

  it('uses the latest state for successive adds and edits without accumulating duplicates', () => {
    const { result } = renderFilters()
    act(() => {
      result.current.addRangeFilters([{ attribute: 'depth', from: 1 }])
      result.current.addRangeFilters([{ attribute: 'age', to: 10 }])
      result.current.toggleRange({ attribute: 'depth', from: 0, to: 5 })
    })
    expect(result.current.rangeFilters).toEqual({ depth: { from: 0, to: 5 }, age: { to: 10 } })
  })

  it('keeps static and qualified ranges distinct', () => {
    const { result } = renderFilters('?ranges=porosity:0~1,numeric_measurements.porosity:2~3')
    expect(result.current.rangeFilters).toEqual({
      porosity: { from: '0', to: '1' },
      'numeric_measurements.porosity': { from: '2', to: '3' },
    })
    act(() => result.current.removeRangeFilter('numeric_measurements.porosity'))
    expect(result.current.rangeFilters).toEqual({ porosity: { from: '0', to: '1' } })
  })

  it('clears ranges without resurrecting removed filters', async () => {
    const { result, onUrlUpdate } = renderFilters('?ranges=depth:0~,numeric_measurements.pore.size:1~2')
    act(() => result.current.setRangeFilters(null))
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledTimes(1))
    expect(onUrlUpdate.mock.calls[0][0].queryString).toBe('')
    act(() => result.current.toggleRange({ attribute: 'depth', from: 0 }))
    expect(result.current.rangeFilters).toEqual({ depth: { from: 0 } })
  })

  it('ignores obsolete measurement_ranges URLs', () => {
    const { result } = renderFilters('?measurement_ranges=porosity:1~10')
    expect(result.current.rangeFilters).toEqual({})
  })

  it('replaces the complete range without retaining old bounds or mutating previous state', () => {
    const { result } = renderFilters('?ranges=depth:1~10,age:~20')
    const previous = result.current.rangeFilters
    act(() => result.current.toggleRange({ attribute: 'depth', from: 0 }))
    expect(result.current.rangeFilters).toEqual({ depth: { from: 0 }, age: { from: '', to: '20' } })
    expect(previous.depth).toEqual({ from: '1', to: '10' })
  })

  it('adds and removes prototype-named keys without altering the object prototype', () => {
    const { result } = renderFilters()
    act(() => result.current.addRangeFilters([{ attribute: '__proto__', from: 0 }]))
    expect(Object.hasOwn(result.current.rangeFilters, '__proto__')).toBe(true)
    expect(Object.getPrototypeOf(result.current.rangeFilters)).toBe(Object.prototype)
    act(() => result.current.removeRangeFilter('__proto__'))
    expect(result.current.rangeFilters).toEqual({})
  })
})
