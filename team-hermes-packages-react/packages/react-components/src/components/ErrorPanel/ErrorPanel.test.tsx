import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vite-plus/test'

import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel'
import { messageFor, safeStringify } from '@/components/ErrorPanel/ErrorPanel.utils'
import type { ApiError } from '@/shared/platform/api'

describe('ErrorPanel', () => {
  test('renders a network error with traceId', () => {
    const err: ApiError = { kind: 'network', traceId: 'trace-1', message: 'offline' }
    render(<ErrorPanel error={err} />)
    expect(screen.getByText('Network error')).toBeInTheDocument()
    expect(screen.getByText('offline')).toBeInTheDocument()
    expect(screen.getByText('trace-1')).toBeInTheDocument()
  })

  test('maps http 403 to "Not allowed"', () => {
    const err: ApiError = { kind: 'http', status: 403, traceId: 't', message: 'forbidden' }
    render(<ErrorPanel error={err} />)
    expect(screen.getByText('Not allowed')).toBeInTheDocument()
  })

  test('maps http 404 to "Not found"', () => {
    const err: ApiError = { kind: 'http', status: 404, traceId: 't', message: 'missing' }
    render(<ErrorPanel error={err} />)
    expect(screen.getByText('Not found')).toBeInTheDocument()
  })

  test('maps http 5xx to "Server error"', () => {
    const err: ApiError = { kind: 'http', status: 503, traceId: 't', message: 'down' }
    render(<ErrorPanel error={err} />)
    expect(screen.getByText('Server error')).toBeInTheDocument()
  })

  test('maps other http statuses to a generic "Request failed (N)" label', () => {
    const err: ApiError = { kind: 'http', status: 418, traceId: 't', message: 'teapot' }
    render(<ErrorPanel error={err} />)
    expect(screen.getByText('Request failed (418)')).toBeInTheDocument()
  })

  test('renders parse errors with their own title', () => {
    const err: ApiError = { kind: 'parse', traceId: 't', message: 'bad json' }
    render(<ErrorPanel error={err} />)
    expect(screen.getByText('Unexpected response from server')).toBeInTheDocument()
  })

  test('falls back to a generic title for unknown errors and omits the traceId', () => {
    render(<ErrorPanel error={new Error('boom')} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/boom/)).toBeInTheDocument()
    expect(screen.queryByText(/traceId/)).toBeNull()
  })

  test('does not crash rendering an unknown error with a circular reference', () => {
    const circular: Record<string, unknown> = { a: 1 }
    circular.self = circular
    const { getByText } = render(<ErrorPanel error={circular} />)
    expect(getByText('Something went wrong')).toBeInTheDocument()
  })

  test('renders circular null-prototype errors without throwing', () => {
    const circular = Object.create(null) as Record<string, unknown>
    circular.self = circular
    render(<ErrorPanel error={circular} />)
    expect(screen.getByText('[object Object]')).toBeInTheDocument()
  })

  test('renders thrown strings without JSON quotes', () => {
    render(<ErrorPanel error="boom" />)
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  test('stringifies undefined errors', () => {
    expect(safeStringify(undefined)).toBe('undefined')
  })

  test('stringifies function errors', () => {
    const fn = function handleError() {}
    expect(safeStringify(fn)).toBe(String(fn))
  })

  test('stringifies symbol errors', () => {
    expect(safeStringify(Symbol('problem'))).toBe('Symbol(problem)')
  })

  test('falls back to a string for circular objects', () => {
    const circular: Record<string, unknown> = { a: 1 }
    circular.self = circular
    expect(safeStringify(circular)).toBe('[object Object]')
  })

  test('falls back for circular null-prototype objects', () => {
    const circular = Object.create(null) as Record<string, unknown>
    circular.self = circular
    expect(safeStringify(circular)).toBe('[object Object]')
  })

  test('returns a final fallback when all string conversions throw', () => {
    const unstringifiable = Object.create(null) as Record<string | symbol, unknown>
    unstringifiable.toJSON = () => {
      throw new Error('serialization failed')
    }
    Object.defineProperty(unstringifiable, Symbol.toStringTag, {
      get() {
        throw new Error('tag lookup failed')
      },
    })

    expect(safeStringify(unstringifiable)).toBe('[Unserializable value]')
  })

  test('returns thrown string values without JSON quotes', () => {
    expect(messageFor('boom')).toBe('boom')
  })

  test('serializes normal objects as JSON', () => {
    expect(safeStringify({ message: 'problem' })).toBe('{"message":"problem"}')
  })
})
