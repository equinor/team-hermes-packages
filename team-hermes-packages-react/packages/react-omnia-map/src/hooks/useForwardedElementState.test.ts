import { act, renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'

import { useForwardedElementState } from './useForwardedElementState'

const node = document.createElement('div')

// Simulates React attaching the ref to `node` and later detaching it.
function attach(ref: (instance: HTMLDivElement | null) => unknown) {
  let cleanup: unknown
  act(() => {
    cleanup = ref(node)
  })
  return () =>
    act(() => {
      if (typeof cleanup === 'function') cleanup()
      else ref(null)
    })
}

describe('useForwardedElementState', () => {
  it('exposes the attached element as state and clears it on detach', () => {
    const { result } = renderHook(() => useForwardedElementState<HTMLDivElement>(undefined))
    expect(result.current[0]).toBeNull()

    const detach = attach(result.current[1])
    expect(result.current[0]).toBe(node)

    detach()
    expect(result.current[0]).toBeNull()
  })

  it('forwards to an object ref', () => {
    const forwarded = createRef<HTMLDivElement>()
    const { result } = renderHook(() => useForwardedElementState(forwarded))

    const detach = attach(result.current[1])
    expect(forwarded.current).toBe(node)

    detach()
    expect(forwarded.current).toBeNull()
  })

  it('forwards to a callback ref and calls it with null on detach', () => {
    const forwarded = vi.fn()
    const { result } = renderHook(() => useForwardedElementState<HTMLDivElement>(forwarded))

    const detach = attach(result.current[1])
    expect(forwarded).toHaveBeenCalledTimes(1)
    expect(forwarded).toHaveBeenCalledWith(node)

    detach()
    expect(forwarded).toHaveBeenCalledTimes(2)
    expect(forwarded).toHaveBeenLastCalledWith(null)
  })

  it('runs the cleanup returned by a callback ref instead of calling it with null', () => {
    const consumerCleanup = vi.fn()
    const forwarded = vi.fn(() => consumerCleanup)
    const { result } = renderHook(() => useForwardedElementState<HTMLDivElement>(forwarded))

    const detach = attach(result.current[1])
    expect(forwarded).toHaveBeenCalledTimes(1)
    expect(consumerCleanup).not.toHaveBeenCalled()

    detach()
    expect(consumerCleanup).toHaveBeenCalledTimes(1)
    expect(forwarded).toHaveBeenCalledTimes(1)
    expect(result.current[0]).toBeNull()
  })

  it('returns a stable ref while the forwarded ref is unchanged', () => {
    const forwarded = createRef<HTMLDivElement>()
    const { result, rerender } = renderHook(({ ref }) => useForwardedElementState(ref), {
      initialProps: { ref: forwarded },
    })
    const first = result.current[1]

    rerender({ ref: forwarded })
    expect(result.current[1]).toBe(first)

    rerender({ ref: createRef<HTMLDivElement>() })
    expect(result.current[1]).not.toBe(first)
  })
})
