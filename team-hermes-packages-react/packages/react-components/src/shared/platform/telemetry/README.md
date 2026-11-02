# Telemetry

Application sends telemetry through `trackException`, `trackEvent`, and
`setUser`.

`main.tsx` creates the configured backend, registers global error handlers,
and supplies telemetry to React through `TelemetryProvider`.

## Backends

`VITE_TELEMETRY` selects the backend:

| Value         | Behavior                                                                              |
| ------------- | ------------------------------------------------------------------------------------- |
| `appinsights` | Azure Application Insights through the BFF at `/api/monitoring/` (production default) |
| `console`     | `console.*` (development default)                                                     |
| `none`        | No-op                                                                                 |

Application Insights uses the BFF, so the SPA does not contain a connection
string or instrumentation key.

## Usage

```tsx
const telemetry = useTelemetry()
telemetry.trackEvent('showcase.toast.fired', { variant: 'success' })
```
