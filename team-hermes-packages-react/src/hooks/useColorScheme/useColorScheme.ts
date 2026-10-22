import { useEffect, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

type ColorScheme = 'light' | 'dark'

const STORAGE_KEY = 'color-scheme'
const ATTRIBUTE = 'data-color-scheme'

/** Attribute set on `<html>` while `toggleColorScheme` runs its crossfade view transition. */
export const COLOR_SCHEME_TRANSITION_ATTRIBUTE = 'data-color-scheme-transition'

const listeners = new Set<() => void>()
let activeTransition: ViewTransition | null = null

function getSystemPreference(): ColorScheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredPreference(): ColorScheme | null {
  return localStorage.getItem(STORAGE_KEY) as ColorScheme | null
}

function applyScheme(scheme: ColorScheme) {
  document.documentElement.setAttribute(ATTRIBUTE, scheme)
}

function getSnapshot(): ColorScheme {
  return (document.documentElement.getAttribute(ATTRIBUTE) as ColorScheme) ?? 'dark'
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === ATTRIBUTE) {
        callback()
      }
    }
  })
  observer.observe(document.documentElement, { attributes: true })
  return () => {
    listeners.delete(callback)
    observer.disconnect()
  }
}

function flipColorScheme() {
  const next: ColorScheme = getSnapshot() === 'light' ? 'dark' : 'light'
  localStorage.setItem(STORAGE_KEY, next)
  applyScheme(next)
}

function toggleColorScheme() {
  if (
    typeof document.startViewTransition !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    flipColorScheme()
    return
  }

  const root = document.documentElement
  root.setAttribute(COLOR_SCHEME_TRANSITION_ATTRIBUTE, '')

  const transition = document.startViewTransition(() => {
    // The MutationObserver notifies subscribers asynchronously. Notify them inside flushSync instead, so
    // components (like the toggle's icon and aria-pressed) are updated before the new view is captured.
    flushSync(() => {
      flipColorScheme()
      for (const listener of listeners) {
        listener()
      }
    })
  })
  activeTransition = transition

  // Rejects when the animation is skipped, e.g. in hidden tabs. The update callback still runs.
  transition.ready.catch(() => {})

  // A newer transition skips this one and settles its `finished` early, so only the latest may clear the marker.
  const clearMarker = () => {
    if (activeTransition === transition) {
      activeTransition = null
      root.removeAttribute(COLOR_SCHEME_TRANSITION_ATTRIBUTE)
    }
  }
  transition.finished.then(clearMarker, clearMarker)
}

export function initColorScheme() {
  const stored = getStoredPreference()
  applyScheme(stored ?? getSystemPreference())
}

export function useColorScheme() {
  const colorScheme = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (!getStoredPreference()) {
        applyScheme(getSystemPreference())
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return { colorScheme, toggleColorScheme } as const
}
