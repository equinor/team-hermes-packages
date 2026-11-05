import { type ApiError, isApiError } from '@/shared/platform/api'

export const titleFor = (error: unknown): string => {
  if (!isApiError(error)) return 'Something went wrong'
  switch (error.kind) {
    case 'network':
      return 'Network error'
    case 'parse':
      return 'Unexpected response from server'
    case 'http':
      if (error.status === 403) return 'Not allowed'
      if (error.status === 404) return 'Not found'
      if (error.status >= 500) return 'Server error'
      return `Request failed (${error.status})`
  }
}

// JSON.stringify throws on circular references (and on BigInt values).
// This runs while rendering the error UI itself, so a throw here would
// crash the page trying to show an error — fall back to a best-effort
// String() conversion instead.
export const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    try {
      return String(value)
    } catch {
      try {
        return Object.prototype.toString.call(value)
      } catch {
        return '[Unserializable value]'
      }
    }
  }
}

export const messageFor = (error: unknown): string => {
  if (isApiError(error)) return error.message
  if (error instanceof Response) return `${error.status} ${error.statusText || 'Error'}`.trim()
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error == null) return 'Unknown error'
  return safeStringify(error)
}

export const traceIdFor = (error: unknown): string | null => (isApiError(error) ? (error as ApiError).traceId : null)
