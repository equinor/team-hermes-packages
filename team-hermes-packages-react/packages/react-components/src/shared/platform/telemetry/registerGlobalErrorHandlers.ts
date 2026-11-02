import type { Telemetry } from './types'

// Catches errors that escape React (event handlers, setTimeout, fire-and-forget
// promises). Render-time errors are handled by TelemetryErrorBoundary.
export const registerGlobalErrorHandlers = (telemetry: Telemetry) => {
  const onRejection = (e: PromiseRejectionEvent) =>
    telemetry.trackException(e.reason, { source: 'unhandledrejection' })
  const onError = (e: ErrorEvent) => telemetry.trackException(e.error ?? e.message, { source: 'window.onerror' })
  window.addEventListener('unhandledrejection', onRejection)
  window.addEventListener('error', onError)

  return () => {
    window.removeEventListener('unhandledrejection', onRejection)
    window.removeEventListener('error', onError)
  }
}
