/// <reference types="vite-plus/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the source repository (used by `<VersionText>`).
   * Override per-environment via the `VITE_REPO_URL` env var.
   */
  readonly VITE_REPO_URL?: string

  /**
   * Telemetry backend selector. One of `appinsights | console | none`.
   * Parsed in `@/config/env`; falls back to `console` in dev and
   * `none` in production when unset/unknown.
   */
  readonly VITE_TELEMETRY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
