import type { ApiError } from './types'

// Type guard — used by the global query/mutation cache and by `<ErrorPanel>`.
// Validates the full shape (not just presence of `kind`/`traceId`) so an
// arbitrary object can't be misclassified as an ApiError and produce
// undefined UI strings or wrong retry/telemetry behavior downstream.
export const isApiError = (e: unknown): e is ApiError => {
  if (typeof e !== 'object' || e === null) return false
  const candidate = e as Record<string, unknown>
  if (typeof candidate.traceId !== 'string' || typeof candidate.message !== 'string') {
    return false
  }
  switch (candidate.kind) {
    case 'network':
    case 'parse':
      return true
    case 'http':
      return typeof candidate.status === 'number'
    default:
      return false
  }
}

export const isAbortError = (e: unknown): boolean => {
  return typeof e === 'object' && e !== null && 'name' in e && e.name === 'AbortError'
}
