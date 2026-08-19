import { TelemetryBackend } from './backend'
import { createConsoleTelemetry } from './backends/console'
import { createNoopTelemetry } from './backends/noop'
import type { Telemetry } from './types'

export { isTelemetryBackend, TelemetryBackend } from './backend'

/**
 * The AppInsights SDK (`@microsoft/applicationinsights-web` +
 * `-react-js`) is a large dependency that most environments never load
 * (default backend is `console`/`none`). Dynamically importing it here
 * lets the bundler split it into its own chunk, fetched only when
 * `VITE_TELEMETRY=appinsights` is actually set. Calls made before the
 * chunk resolves are buffered and flushed in order once it's ready, so
 * callers still get a synchronous `Telemetry` object immediately.
 */
const createLazyAppInsightsTelemetry = (): Telemetry => {
  let real: Telemetry | null = null
  const queue: (() => void)[] = []

  const flush = () => {
    for (const call of queue) call()
    queue.length = 0
  }

  import('./backends/appinsights')
    .then(({ createAppInsightsTelemetry }) => {
      real = createAppInsightsTelemetry()
    })
    .catch((err: unknown) => {
      console.error('Failed to load AppInsights telemetry backend', err)
      real = createNoopTelemetry()
    })
    .finally(flush)

  return {
    trackException: (err, ctx) => {
      if (real) real.trackException(err, ctx)
      else queue.push(() => real?.trackException(err, ctx))
    },
    trackEvent: (name, props) => {
      if (real) real.trackEvent(name, props)
      else queue.push(() => real?.trackEvent(name, props))
    },
    setUser: (id) => {
      if (real) real.setUser(id)
      else queue.push(() => real?.setUser(id))
    },
  }
}

export const createTelemetry = (backend: TelemetryBackend): Telemetry => {
  switch (backend) {
    case TelemetryBackend.AppInsights:
      return createLazyAppInsightsTelemetry()
    case TelemetryBackend.Console:
      return createConsoleTelemetry()
    case TelemetryBackend.None:
      return createNoopTelemetry()
  }
}
