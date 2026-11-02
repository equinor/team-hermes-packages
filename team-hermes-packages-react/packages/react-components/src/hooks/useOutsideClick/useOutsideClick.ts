import { useEffect } from 'react'

/**
 * Custom hook to detect clicks outside of a specified element.
 * @param ref - React ref object pointing to the element to monitor.
 * @param callback - Function to call when a click outside the element is detected.
 */
export function useOutsideClick(refs: React.RefObject<HTMLElement | null>[], callback: () => void) {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!refs || refs.length === 0) return
      const anyRefContainsTarget = refs.some((ref) =>
        ref?.current ? ref.current.contains(event.target as Node) : false
      )
      if (!anyRefContainsTarget) {
        callback()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [refs, callback])
}
