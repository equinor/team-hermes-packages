import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { COLOR_SCHEME_TRANSITION_ATTRIBUTE, useColorScheme } from './useColorScheme'

const root = document.documentElement

function createDeferred() {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function stubMatchMedia({ reducedMotion = false } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function setStartViewTransition(value: unknown) {
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value })
}

/** Records each transition so tests can run its update callback and settle its promises like a browser would. */
function mockStartViewTransition() {
  const transitions: {
    update: () => void
    ready: ReturnType<typeof createDeferred>
    finished: ReturnType<typeof createDeferred>
  }[] = []
  const startViewTransition = vi.fn((update: ViewTransitionUpdateCallback) => {
    const ready = createDeferred()
    const finished = createDeferred()
    transitions.push({ update, ready, finished })
    return { ready: ready.promise, finished: finished.promise } as ViewTransition
  })
  setStartViewTransition(startViewTransition)
  return { startViewTransition, transitions }
}

beforeEach(() => {
  root.setAttribute('data-color-scheme', 'light')
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'startViewTransition')
  root.removeAttribute('data-color-scheme')
  root.removeAttribute(COLOR_SCHEME_TRANSITION_ATTRIBUTE)
  localStorage.clear()
})

describe('useColorScheme', () => {
  it('reads the scheme from the data-color-scheme attribute', () => {
    stubMatchMedia()
    root.setAttribute('data-color-scheme', 'dark')

    const { result } = renderHook(() => useColorScheme())

    expect(result.current.colorScheme).toBe('dark')
  })
})

describe('toggleColorScheme', () => {
  it('applies the change directly when view transitions are not supported', async () => {
    stubMatchMedia()
    setStartViewTransition(undefined)
    const { result } = renderHook(() => useColorScheme())

    await act(async () => result.current.toggleColorScheme())

    expect(root).toHaveAttribute('data-color-scheme', 'dark')
    expect(localStorage.getItem('color-scheme')).toBe('dark')
    expect(result.current.colorScheme).toBe('dark')
    expect(root).not.toHaveAttribute(COLOR_SCHEME_TRANSITION_ATTRIBUTE)
  })

  it('applies the change directly when reduced motion is preferred', async () => {
    stubMatchMedia({ reducedMotion: true })
    const { startViewTransition } = mockStartViewTransition()
    const { result } = renderHook(() => useColorScheme())

    await act(async () => result.current.toggleColorScheme())

    expect(startViewTransition).not.toHaveBeenCalled()
    expect(root).toHaveAttribute('data-color-scheme', 'dark')
    expect(localStorage.getItem('color-scheme')).toBe('dark')
    expect(result.current.colorScheme).toBe('dark')
    expect(root).not.toHaveAttribute(COLOR_SCHEME_TRANSITION_ATTRIBUTE)
  })

  it('switches the scheme in a view transition and marks <html> while it runs', async () => {
    stubMatchMedia()
    const { startViewTransition, transitions } = mockStartViewTransition()
    const { result } = renderHook(() => useColorScheme())

    act(() => result.current.toggleColorScheme())

    expect(startViewTransition).toHaveBeenCalledOnce()
    expect(root).toHaveAttribute(COLOR_SCHEME_TRANSITION_ATTRIBUTE)
    expect(root).toHaveAttribute('data-color-scheme', 'light')

    const [transition] = transitions
    act(() => {
      transition.update()
      // Rendered synchronously, before the browser captures the new view.
      expect(result.current.colorScheme).toBe('dark')
    })
    expect(root).toHaveAttribute('data-color-scheme', 'dark')
    expect(localStorage.getItem('color-scheme')).toBe('dark')

    transition.ready.resolve()
    await transition.ready.promise
    expect(root).toHaveAttribute(COLOR_SCHEME_TRANSITION_ATTRIBUTE)

    transition.finished.resolve()
    await transition.finished.promise
    expect(root).not.toHaveAttribute(COLOR_SCHEME_TRANSITION_ATTRIBUTE)
  })

  it('keeps the marker until the latest of two overlapping transitions finishes', async () => {
    stubMatchMedia()
    const { transitions } = mockStartViewTransition()
    const { result } = renderHook(() => useColorScheme())

    act(() => result.current.toggleColorScheme())
    const [first] = transitions
    act(() => first.update())
    first.ready.resolve()

    act(() => result.current.toggleColorScheme())
    const second = transitions[1]
    // Starting the second transition skips the first, which settles its `finished` early.
    first.finished.resolve()
    await first.finished.promise
    expect(root).toHaveAttribute(COLOR_SCHEME_TRANSITION_ATTRIBUTE)

    act(() => second.update())
    second.ready.resolve()
    second.finished.resolve()
    await second.finished.promise

    expect(root).not.toHaveAttribute(COLOR_SCHEME_TRANSITION_ATTRIBUTE)
    expect(root).toHaveAttribute('data-color-scheme', 'light')
    expect(localStorage.getItem('color-scheme')).toBe('light')
    expect(result.current.colorScheme).toBe('light')
  })

  it('still applies the scheme without unhandled rejections when `ready` rejects', async () => {
    const onUnhandledRejection = vi.fn()
    process.on('unhandledRejection', onUnhandledRejection)
    try {
      stubMatchMedia()
      const { transitions } = mockStartViewTransition()
      const { result } = renderHook(() => useColorScheme())

      act(() => result.current.toggleColorScheme())
      const [transition] = transitions
      // Browsers skip the animation in hidden tabs, but still run the update callback.
      transition.ready.reject(new DOMException('View transition was skipped', 'InvalidStateError'))
      act(() => transition.update())
      transition.finished.resolve()
      await transition.finished.promise
      await new Promise((resolve) => setTimeout(resolve))

      expect(onUnhandledRejection).not.toHaveBeenCalled()
      expect(root).toHaveAttribute('data-color-scheme', 'dark')
      expect(localStorage.getItem('color-scheme')).toBe('dark')
      expect(result.current.colorScheme).toBe('dark')
      expect(root).not.toHaveAttribute(COLOR_SCHEME_TRANSITION_ATTRIBUTE)
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  })
})
