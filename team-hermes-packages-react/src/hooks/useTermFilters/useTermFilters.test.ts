import { act, renderHook, waitFor } from '@testing-library/react'
import { type UrlUpdateEvent, withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useTermFilters } from './useTermFilters'

describe('unified term filters', () => {
  it('reads canonical keys without rewriting history and updates terms on edit', async () => {
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()
    const { result } = renderHook(useTermFilters, {
      wrapper: withNuqsTestingAdapter({
        searchParams:
          '?terms=formation:shale,categorical_measurements.formation:sandstone,categorical_measurements.quality.grade:good',
        onUrlUpdate,
        hasMemory: true,
      }),
    })
    expect(result.current.termFilters).toEqual({
      formation: ['shale'],
      'categorical_measurements.formation': ['sandstone'],
      'categorical_measurements.quality.grade': ['good'],
    })
    expect(onUrlUpdate).not.toHaveBeenCalled()
    act(() => result.current.toggleTermFilterValue('categorical_measurements.formation', 'sandstone'))
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledTimes(1))
    const { searchParams, options } = onUrlUpdate.mock.calls[0][0]
    expect(options.history).toBe('push')
    expect([...searchParams.keys()]).toEqual(['terms'])
    expect(searchParams.get('terms')).toContain('categorical_measurements.formation:')
    expect(result.current.termFilters.formation).toEqual(['shale'])
    expect(result.current.termFilters['categorical_measurements.formation']).toEqual([])
  })

  it('merges duplicate selections identically for static and measurement keys', () => {
    const { result } = renderHook(useTermFilters, {
      wrapper: withNuqsTestingAdapter({
        searchParams:
          '?terms=formation:shale,formation:sandstone,categorical_measurements.grade:old,categorical_measurements.grade:new',
      }),
    })
    expect(result.current.termFilters).toEqual({
      formation: ['shale', 'sandstone'],
      'categorical_measurements.grade': ['old', 'new'],
    })
  })

  it('preserves empty selections', () => {
    const { result } = renderHook(useTermFilters, {
      wrapper: withNuqsTestingAdapter({
        searchParams: '?terms=categorical_measurements.grade:',
      }),
    })
    expect(result.current.termFilters).toEqual({ 'categorical_measurements.grade': [] })
  })

  it('uses current state across multiple consumers and successive toggles', () => {
    const { result } = renderHook(() => ({ sidebar: useTermFilters(), chips: useTermFilters() }), {
      wrapper: withNuqsTestingAdapter(),
    })
    act(() => {
      result.current.sidebar.toggleTermFilterValue('formation', 'shale')
      result.current.sidebar.toggleTermFilterValue('formation', 'sandstone')
      result.current.sidebar.toggleTermFilterValue('formation', 'shale')
    })
    act(() => {
      result.current.chips.addTermFilters([{ attribute: 'categorical_measurements.formation', value: ['good'] }])
    })
    expect(result.current.sidebar.termFilters).toEqual({
      formation: ['sandstone'],
      'categorical_measurements.formation': ['good'],
    })
    expect(result.current.chips.termFilters).toEqual(result.current.sidebar.termFilters)
  })

  it('removes and resets selections without bringing them back on later edits', async () => {
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()
    const { result } = renderHook(useTermFilters, {
      wrapper: withNuqsTestingAdapter({
        searchParams: '?terms=formation:shale,categorical_measurements.grade:old',
        onUrlUpdate,
        hasMemory: true,
      }),
    })
    act(() => result.current.removeTermFilter('categorical_measurements.grade'))
    expect(result.current.termFilters).toEqual({ formation: ['shale'] })
    act(() => result.current.setTermFilters(null))
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe('')
    act(() => result.current.addTermFilters([{ attribute: 'analysis_type', value: ['RCA'] }]))
    expect(result.current.termFilters).toEqual({ analysis_type: ['RCA'] })
  })

  it('ignores obsolete measurement_terms URLs', () => {
    const { result } = renderHook(useTermFilters, {
      wrapper: withNuqsTestingAdapter({ searchParams: '?measurement_terms=grade:old' }),
    })
    expect(result.current.termFilters).toEqual({})
  })

  it('replaces a selection by key without merging it back or mutating the previous state', () => {
    const { result } = renderHook(useTermFilters, {
      wrapper: withNuqsTestingAdapter({ searchParams: '?terms=formation:shale|sandstone,laboratory:A' }),
    })
    const previous = result.current.termFilters
    act(() => result.current.addTermFilters([{ attribute: 'formation', value: ['sandstone'] }]))
    expect(result.current.termFilters).toEqual({ formation: ['sandstone'], laboratory: ['A'] })
    expect(previous).toEqual({ formation: ['shale', 'sandstone'], laboratory: ['A'] })
    act(() => result.current.toggleTermFilterValue('formation', 'sandstone'))
    expect(result.current.termFilters.formation).toEqual([])
  })

  it.each(['__proto__', 'constructor', 'toString'])(
    'treats %s as a filter key rather than an inherited property',
    (key) => {
      const { result } = renderHook(useTermFilters, { wrapper: withNuqsTestingAdapter() })
      act(() => result.current.toggleTermFilterValue(key, 'safe'))
      expect(Object.hasOwn(result.current.termFilters, key)).toBe(true)
      expect(result.current.termFilters[key]).toEqual(['safe'])
      const previous = result.current.termFilters
      act(() => result.current.removeTermFilter(key))
      expect(result.current.termFilters).toEqual({})
      expect(previous[key]).toEqual(['safe'])
    }
  )
})
