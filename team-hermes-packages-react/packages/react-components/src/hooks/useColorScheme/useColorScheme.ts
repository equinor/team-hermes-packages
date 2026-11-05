import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

export type ColorScheme = 'light' | 'dark'
export type ColorSchemePreference = ColorScheme | 'auto'

const STORAGE_KEY = 'color-scheme'
const ATTRIBUTE = 'data-color-scheme'
const PREFERENCE_ATTRIBUTE = 'data-color-scheme-preference'

/** Attribute set on `<html>` while `toggleColorScheme` runs its crossfade view transition. */
export const COLOR_SCHEME_TRANSITION_ATTRIBUTE = 'data-color-scheme-transition'

const listeners = new Set<() => void>()
let activeTransition: ViewTransition | null = null

function getSystemPreference(): ColorScheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function isPreference(value: string | null): value is ColorSchemePreference {
  return value === 'light' || value === 'dark' || value === 'auto'
}

function getStoredPreference(): ColorSchemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isPreference(stored) ? stored : 'auto'
  } catch (error) {
    console.warn('Unable to read color scheme preference from localStorage:', error)
    return 'auto'
  }
}

function getPreference(): ColorSchemePreference {
  const preference = document.documentElement.getAttribute(PREFERENCE_ATTRIBUTE)
  return isPreference(preference) ? preference : getStoredPreference()
}

function resolveScheme(preference: ColorSchemePreference): ColorScheme {
  return preference === 'auto' ? getSystemPreference() : preference
}

function applyScheme(scheme: ColorScheme) {
  document.documentElement.setAttribute(ATTRIBUTE, scheme)
}

function getSnapshot(): ColorScheme {
  const scheme = document.documentElement.getAttribute(ATTRIBUTE)
  return scheme === 'light' || scheme === 'dark' ? scheme : resolveScheme(getPreference())
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === ATTRIBUTE || mutation.attributeName === PREFERENCE_ATTRIBUTE) {
        callback()
      }
    }
  })
  observer.observe(document.documentElement, { attributeFilter: [ATTRIBUTE, PREFERENCE_ATTRIBUTE] })
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleSystemChange = () => {
    if (getPreference() === 'auto') {
      applyScheme(getSystemPreference())
      callback()
    }
  }
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      initColorScheme()
    }
  }
  mediaQuery.addEventListener('change', handleSystemChange)
  window.addEventListener('storage', handleStorageChange)
  if (!document.documentElement.hasAttribute(ATTRIBUTE)) {
    applyScheme(resolveScheme(getPreference()))
  }
  return () => {
    listeners.delete(callback)
    observer.disconnect()
    mediaQuery.removeEventListener('change', handleSystemChange)
    window.removeEventListener('storage', handleStorageChange)
  }
}

function applyPreference(preference: ColorSchemePreference) {
  // Keep the choice for this page even when persistence is unavailable.
  document.documentElement.setAttribute(PREFERENCE_ATTRIBUTE, preference)
  try {
    window.localStorage.setItem(STORAGE_KEY, preference)
  } catch (error) {
    console.warn('Unable to save color scheme preference to localStorage:', error)
  }
  applyScheme(resolveScheme(preference))
  for (const listener of listeners) {
    listener()
  }
}

function changeColorScheme(update: () => void) {
  if (
    typeof document.startViewTransition !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    update()
    return
  }

  const root = document.documentElement
  root.setAttribute(COLOR_SCHEME_TRANSITION_ATTRIBUTE, '')

  const transition = document.startViewTransition(() => {
    // The MutationObserver notifies subscribers asynchronously. Notify them inside flushSync instead, so
    // components (like the toggle's icon and aria-pressed) are updated before the new view is captured.
    flushSync(() => {
      update()
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

function setColorScheme(preference: ColorSchemePreference) {
  changeColorScheme(() => applyPreference(preference))
}

function toggleColorScheme() {
  changeColorScheme(() => applyPreference(getSnapshot() === 'light' ? 'dark' : 'light'))
}

export function initColorScheme() {
  const preference = getStoredPreference()
  document.documentElement.setAttribute(PREFERENCE_ATTRIBUTE, preference)
  applyScheme(resolveScheme(preference))
  for (const listener of listeners) {
    listener()
  }
}

export function useColorScheme() {
  const colorScheme = useSyncExternalStore(subscribe, getSnapshot)
  const colorSchemePreference = useSyncExternalStore(subscribe, getPreference)

  return { colorScheme, colorSchemePreference, setColorScheme, toggleColorScheme } as const
}
