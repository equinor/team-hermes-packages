import { useCallback, useEffect, useSyncExternalStore } from 'react'

type ColorScheme = 'light' | 'dark'

const STORAGE_KEY = 'color-scheme'
const ATTRIBUTE = 'data-color-scheme'

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
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === ATTRIBUTE) {
        callback()
      }
    }
  })
  observer.observe(document.documentElement, { attributes: true })
  return () => observer.disconnect()
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

  const toggleColorScheme = useCallback(() => {
    const next: ColorScheme = getSnapshot() === 'light' ? 'dark' : 'light'
    localStorage.setItem(STORAGE_KEY, next)
    applyScheme(next)
  }, [])

  return { colorScheme, toggleColorScheme } as const
}
