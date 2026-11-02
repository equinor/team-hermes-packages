/**
 * Regression tests for the AppInsights backend's safe stringify behavior:
 * JSON.stringify throws on circular references, which must not make
 * trackException/trackEvent throw (that would happen inside error
 * handling code paths and could mask the original error).
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

const trackExceptionMock = vi.fn()
const trackEventMock = vi.fn()
const loadAppInsightsMock = vi.fn()
const trackPageViewMock = vi.fn()
let capturedConfig: Record<string, unknown> | undefined

vi.mock('@microsoft/applicationinsights-web', () => ({
  ApplicationInsights: class {
    loadAppInsights = loadAppInsightsMock
    trackPageView = trackPageViewMock
    trackException = trackExceptionMock
    trackEvent = trackEventMock
    setAuthenticatedUserContext = vi.fn()
    clearAuthenticatedUserContext = vi.fn()
    constructor({ config }: { config: Record<string, unknown> }) {
      capturedConfig = config
    }
  },
}))

vi.mock('@microsoft/applicationinsights-react-js', () => ({
  ReactPlugin: class {},
}))

beforeEach(() => {
  trackExceptionMock.mockClear()
  trackEventMock.mockClear()
})

describe('createAppInsightsTelemetry — safe stringify', () => {
  test('trackException does not throw on a circular error context', async () => {
    const { createAppInsightsTelemetry } = await import('./appinsights')
    const telemetry = createAppInsightsTelemetry()

    const circular: Record<string, unknown> = { a: 1 }
    circular.self = circular

    expect(() => telemetry.trackException(new Error('boom'), { circular })).not.toThrow()
    expect(trackExceptionMock).toHaveBeenCalledTimes(1)
    const payload = trackExceptionMock.mock.calls[0][0]
    // Falls back to String(value) ("[object Object]") instead of throwing.
    expect(payload.properties.circular).toBe('[object Object]')
  })

  test('trackEvent does not throw on a circular properties value', async () => {
    const { createAppInsightsTelemetry } = await import('./appinsights')
    const telemetry = createAppInsightsTelemetry()

    const circular: Record<string, unknown> = { a: 1 }
    circular.self = circular

    expect(() => telemetry.trackEvent('some-event', { circular })).not.toThrow()
    expect(trackEventMock).toHaveBeenCalledTimes(1)
  })

  test('toError falls back to a stringified message for a circular non-Error value', async () => {
    const { createAppInsightsTelemetry } = await import('./appinsights')
    const telemetry = createAppInsightsTelemetry()

    const circular: Record<string, unknown> = { a: 1 }
    circular.self = circular

    expect(() => telemetry.trackException(circular)).not.toThrow()
    const payload = trackExceptionMock.mock.calls[0][0]
    expect(payload.exception).toBeInstanceOf(Error)
    expect(payload.exception.message).toBe('[object Object]')
  })
})

describe('createAppInsightsTelemetry — correlationHeaderDomains', () => {
  test('scopes correlation headers to location.host (host+port), not just hostname', async () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      value: { host: 'example.com:4321' } as Location,
      writable: true,
      configurable: true,
    })

    try {
      const { createAppInsightsTelemetry } = await import('./appinsights')
      createAppInsightsTelemetry()

      expect(capturedConfig?.correlationHeaderDomains).toEqual(['example.com:4321'])
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      })
    }
  })
})
