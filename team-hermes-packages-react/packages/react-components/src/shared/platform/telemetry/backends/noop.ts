import type { Telemetry } from '@/shared/platform/telemetry/types'

export const createNoopTelemetry = (): Telemetry => ({
  trackException: () => {},
  trackEvent: () => {},
  setUser: () => {},
})
