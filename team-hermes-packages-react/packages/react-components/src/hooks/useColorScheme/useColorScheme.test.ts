import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { COLOR_SCHEME_TRANSITION_ATTRIBUTE, initColorScheme, useColorScheme } from './useColorScheme'

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

function stubMatchMedia({ reducedMotion = false, dark = false } = {}) {
  const mediaQuery = new EventTarget()
  const addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) =>
    mediaQuery.addEventListener(type, listener)
  )
  const removeEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) =>
    mediaQuery.removeEventListener(type, listener)
  )
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? dark : reducedMotion,
    media: query,
    addEventListener,
    removeEventListener,
  }))
  return {
    changeSystemPreference: (next: boolean) => {
      dark = next
      mediaQuery.dispatchEvent(new Event('change'))
    },
    addEventListener,
    removeEventListener,
  }
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
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'startViewTransition')
  root.removeAttribute('data-color-scheme')
  root.removeAttribute('data-color-scheme-preference')
  root.removeAttribute(COLOR_SCHEME_TRANSITION_ATTRIBUTE)
  localStorage.clear()
})

describe('useColorScheme', () => {
  it.each([false, true])('uses the OS preference without initialization (dark=%s)', (dark) => {
    stubMatchMedia({ dark })
    root.removeAttribute('data-color-scheme')
    const { result } = renderHook(() => useColorScheme())

    expect(result.current.colorSchemePreference).toBe('auto')
    expect(result.current.colorScheme).toBe(dark ? 'dark' : 'light')
    expect(root).toHaveAttribute('data-color-scheme', dark ? 'dark' : 'light')
  })

  it('follows live OS changes only in auto mode and shares the preference between consumers', async () => {
    const { changeSystemPreference } = stubMatchMedia()
    const first = renderHook(() => useColorScheme())
    const second = renderHook(() => useColorScheme())

    await act(async () => first.result.current.setColorScheme('dark'))
    expect(second.result.current.colorSchemePreference).toBe('dark')
    act(() => changeSystemPreference(false))
    expect(first.result.current.colorScheme).toBe('dark')

    await act(async () => first.result.current.setColorScheme('auto'))
    expect(second.result.current.colorSchemePreference).toBe('auto')
    expect(second.result.current.colorScheme).toBe('light')
    expect(localStorage.getItem('color-scheme')).toBe('auto')
    act(() => changeSystemPreference(true))
    expect(second.result.current.colorScheme).toBe('dark')
    expect(root).toHaveAttribute('data-color-scheme', 'dark')
  })

  it('keeps an explicit choice in memory when localStorage reads and writes throw', async () => {
    const { changeSystemPreference } = stubMatchMedia()
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    initColorScheme()
    const { result } = renderHook(() => useColorScheme())
    await act(async () => result.current.setColorScheme('dark'))
    act(() => changeSystemPreference(false))

    expect(result.current.colorSchemePreference).toBe('dark')
    expect(result.current.colorScheme).toBe('dark')
    expect(warning).toHaveBeenCalled()
    await act(async () => result.current.setColorScheme('auto'))
    expect(result.current.colorScheme).toBe('light')
    act(() => changeSystemPreference(true))
    expect(result.current.colorScheme).toBe('dark')
  })

  it('tolerates access to the localStorage property itself being denied', () => {
    stubMatchMedia({ dark: true })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })

    expect(() => initColorScheme()).not.toThrow()
    expect(root).toHaveAttribute('data-color-scheme', 'dark')
    const { result } = renderHook(() => useColorScheme())
    act(() => result.current.setColorScheme('light'))
    expect(result.current.colorScheme).toBe('light')
  })

  it('synchronizes preferences from storage events, including clearing storage', async () => {
    stubMatchMedia()
    const { result } = renderHook(() => useColorScheme())
    await act(async () => {
      localStorage.setItem('color-scheme', 'dark')
      window.dispatchEvent(new StorageEvent('storage', { key: 'color-scheme' }))
    })
    expect(result.current.colorSchemePreference).toBe('dark')
    expect(result.current.colorScheme).toBe('dark')
    await act(async () => {
      localStorage.clear()
      window.dispatchEvent(new StorageEvent('storage', { key: null }))
    })
    expect(result.current.colorSchemePreference).toBe('auto')
    expect(result.current.colorScheme).toBe('light')
  })

  it('removes system listeners on unmount', () => {
    const { addEventListener, removeEventListener } = stubMatchMedia()
    const { unmount } = renderHook(() => useColorScheme())
    unmount()

    expect(addEventListener).toHaveBeenCalled()
    expect(removeEventListener.mock.calls).toEqual(addEventListener.mock.calls)
  })

  it('reads the scheme from the data-color-scheme attribute', () => {
    stubMatchMedia()
    root.setAttribute('data-color-scheme', 'dark')

    const { result } = renderHook(() => useColorScheme())

    expect(result.current.colorScheme).toBe('dark')
  })

  it('continues observing externally applied resolved schemes', async () => {
    stubMatchMedia()
    const { result } = renderHook(() => useColorScheme())
    await act(async () => root.setAttribute('data-color-scheme', 'dark'))

    expect(result.current.colorScheme).toBe('dark')
  })

  describe('initColorScheme', () => {
    it.each([
      { stored: null, dark: false, preference: 'auto', scheme: 'light' },
      { stored: null, dark: true, preference: 'auto', scheme: 'dark' },
      { stored: 'auto', dark: true, preference: 'auto', scheme: 'dark' },
      { stored: 'invalid', dark: false, preference: 'auto', scheme: 'light' },
      { stored: 'light', dark: true, preference: 'light', scheme: 'light' },
      { stored: 'dark', dark: false, preference: 'dark', scheme: 'dark' },
    ])('applies $stored with system dark=$dark synchronously', ({ stored, dark, preference, scheme }) => {
      stubMatchMedia({ dark })
      if (stored !== null) localStorage.setItem('color-scheme', stored)
      initColorScheme()

      expect(root).toHaveAttribute('data-color-scheme', scheme)
      expect(root).toHaveAttribute('data-color-scheme-preference', preference)
    })
  })
})

describe('toggleColorScheme', () => {
  it('resolves consecutive toggles when each transition update runs', async () => {
    stubMatchMedia()
    const { transitions } = mockStartViewTransition()
    const { result } = renderHook(() => useColorScheme())

    act(() => {
      result.current.toggleColorScheme()
      result.current.toggleColorScheme()
    })
    for (const transition of transitions) {
      act(() => transition.update())
      transition.ready.resolve()
      transition.finished.resolve()
      await transition.finished.promise
    }

    expect(result.current.colorScheme).toBe('light')
    expect(result.current.colorSchemePreference).toBe('light')
  })

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
