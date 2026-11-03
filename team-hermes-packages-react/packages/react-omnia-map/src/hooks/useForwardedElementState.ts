import { type Ref, type RefCallback, useCallback, useState } from 'react'

/**
 * Tracks a rendered element as React state while also forwarding it to a consumer-supplied ref.
 * Supports object refs, callback refs, and React 19 callback refs that return a cleanup.
 */
export function useForwardedElementState<T>(forwardedRef: Ref<T> | undefined) {
  const [element, setElement] = useState<T | null>(null)

  const ref = useCallback<RefCallback<T>>(
    (instance) => {
      setElement(instance)
      if (typeof forwardedRef === 'function') {
        const consumerCleanup = forwardedRef(instance)
        return () => {
          setElement(null)
          // React only calls a callback ref with null when it did not return a cleanup, so mirror that.
          if (typeof consumerCleanup === 'function') consumerCleanup()
          else forwardedRef(null)
        }
      }
      if (forwardedRef) forwardedRef.current = instance
      return () => {
        setElement(null)
        if (forwardedRef) forwardedRef.current = null
      }
    },
    [forwardedRef]
  )

  return [element, ref] as const
}
