import { ReactPlugin } from '@microsoft/applicationinsights-react-js'
import { ApplicationInsights, type IExceptionTelemetry } from '@microsoft/applicationinsights-web'
import type { Telemetry } from '../types'

// JSON.stringify throws on circular references (and on BigInt values).
// Telemetry reporting must never throw — a failure here would happen
// inside error-handling code paths and could mask or replace the
// original error. Fall back to a best-effort String() conversion.
const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const toError = (err: unknown): Error =>
  err instanceof Error ? err : new Error(typeof err === 'string' ? err : safeStringify(err))

/**
 * App Insights only surfaces custom dimensions reliably when nested under
 * `properties`. Stringify non-string values to keep keys intact.
 */
const toProperties = (ctx?: Record<string, unknown>): Record<string, string> | undefined => {
  if (!ctx) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(ctx)) {
    if (v == null) continue
    out[k] = typeof v === 'string' ? v : safeStringify(v)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

// SDK requires a parseable connection string. Ingestion is always proxied
// through the BFF — the SDK derives the destination from `IngestionEndpoint`
// (the trailing slash is required; the SDK appends `v2/track`). The InstrumentationKey is
// meaningless because `disableInstrumentationKeyValidation` is set and the
// BFF replaces it before forwarding to Azure Monitor.
const buildConnectionString = (): string => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  return `InstrumentationKey=00000000-0000-0000-0000-000000000000;IngestionEndpoint=${origin}/api/monitoring/`
}

// `enableCorsCorrelation` makes the SDK attach `Request-Id`/`traceparent`
// correlation headers to outgoing XHR/fetch calls. Without an explicit
// allowlist it would add those headers to every request the app makes,
// including any future calls to third-party/external APIs, leaking
// internal trace identifiers off-origin. Scope it to our own origin only —
// all telemetry-relevant calls already go through the same-origin BFF.
const correlationHeaderDomains = (): string[] => {
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost'
  return [host]
}

export const createAppInsightsTelemetry = (): Telemetry => {
  const plugin = new ReactPlugin()
  const appInsights = new ApplicationInsights({
    config: {
      connectionString: buildConnectionString(),
      disableInstrumentationKeyValidation: true,
      enableAutoRouteTracking: true,
      disableFetchTracking: false,
      autoTrackPageVisitTime: true,
      enableCorsCorrelation: true,
      correlationHeaderDomains: correlationHeaderDomains(),
      // Request/response header tracking is off by default: it can capture
      // sensitive headers (Authorization, cookies, correlation IDs) into
      // telemetry. Only enable with an explicit allow/deny list once there
      // is a concrete need.
      enableRequestHeaderTracking: false,
      enableResponseHeaderTracking: false,
      extensions: [plugin],
    },
  })
  appInsights.loadAppInsights()
  appInsights.trackPageView()

  return {
    trackException: (err, ctx) => {
      const payload: IExceptionTelemetry = {
        exception: toError(err),
        properties: toProperties(ctx),
      }
      appInsights.trackException(payload)
    },
    trackEvent: (name, props) => {
      appInsights.trackEvent({ name, properties: toProperties(props) })
    },
    setUser: (id) => {
      if (id) appInsights.setAuthenticatedUserContext(id, undefined, true)
      else appInsights.clearAuthenticatedUserContext()
    },
  }
}
