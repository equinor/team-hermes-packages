import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import type Layer from '@arcgis/core/layers/Layer'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { usePanLayersIntoView } from './usePanLayersIntoView'

const DEFAULT_DELAY_MS = 300

function createMapElement({ ready = true, inView = false } = {}) {
  const goTo = vi.fn(() => Promise.resolve())
  const intersects = vi.fn(() => inView)
  const view = { ready, scale: 50_000, extent: { intersects }, goTo }
  const element = { view } as unknown as ArcgisMap
  return { element, goTo, intersects }
}

function pointLayer(latitude: number, longitude: number) {
  return new GraphicsLayer({ graphics: [new Graphic({ geometry: new Point({ latitude, longitude }) })] })
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('usePanLayersIntoView', () => {
  it('pans to the graphics at the current scale after the delay', () => {
    const { element, goTo } = createMapElement()
    const layer = pointLayer(60, 5)

    renderHook(() => usePanLayersIntoView(element, [layer]))
    act(() => void vi.advanceTimersByTime(DEFAULT_DELAY_MS - 1))
    expect(goTo).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(1))
    expect(goTo).toHaveBeenCalledWith({ target: layer.graphics.toArray(), scale: 50_000 })
  })

  it('does not pan when any graphic is already in view', () => {
    const { element, goTo } = createMapElement({ inView: true })

    renderHook(() => usePanLayersIntoView(element, [pointLayer(60, 5)]))
    act(() => void vi.advanceTimersByTime(DEFAULT_DELAY_MS))
    expect(goTo).not.toHaveBeenCalled()
  })

  it('restarts the delay when the layers change', () => {
    const { element, goTo } = createMapElement()

    const { rerender } = renderHook(({ layers }) => usePanLayersIntoView(element, layers), {
      initialProps: { layers: [pointLayer(60, 5)] },
    })
    act(() => void vi.advanceTimersByTime(DEFAULT_DELAY_MS - 1))

    const next = pointLayer(61, 6)
    rerender({ layers: [next] })
    act(() => void vi.advanceTimersByTime(DEFAULT_DELAY_MS - 1))
    expect(goTo).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(1))
    expect(goTo).toHaveBeenCalledTimes(1)
    expect(goTo).toHaveBeenCalledWith({ target: next.graphics.toArray(), scale: 50_000 })
  })

  it('cancels a pending pan on unmount', () => {
    const { element, goTo } = createMapElement()

    const { unmount } = renderHook(() => usePanLayersIntoView(element, [pointLayer(60, 5)]))
    unmount()
    act(() => void vi.advanceTimersByTime(DEFAULT_DELAY_MS))
    expect(goTo).not.toHaveBeenCalled()
  })

  it('honours a custom delay', () => {
    const { element, goTo } = createMapElement()

    renderHook(() => usePanLayersIntoView(element, [pointLayer(60, 5)], { delayMs: 0 }))
    act(() => void vi.advanceTimersByTime(0))
    expect(goTo).toHaveBeenCalledTimes(1)
  })

  it('does not pan when the view is not ready', () => {
    const { element, goTo } = createMapElement({ ready: false })

    renderHook(() => usePanLayersIntoView(element, [pointLayer(60, 5)]))
    act(() => void vi.advanceTimersByTime(DEFAULT_DELAY_MS))
    expect(goTo).not.toHaveBeenCalled()
  })

  it('does not pan when the layers have no graphics', () => {
    const { element, goTo } = createMapElement()
    const other = { id: 'tiles' } as unknown as Layer

    renderHook(() => usePanLayersIntoView(element, [new GraphicsLayer(), other]))
    act(() => void vi.advanceTimersByTime(DEFAULT_DELAY_MS))
    expect(goTo).not.toHaveBeenCalled()
  })

  it('does nothing without a map element or without layers', () => {
    const { element, goTo } = createMapElement()

    renderHook(() => usePanLayersIntoView(null, [pointLayer(60, 5)]))
    renderHook(() => usePanLayersIntoView(element, []))
    act(() => void vi.advanceTimersByTime(DEFAULT_DELAY_MS))
    expect(goTo).not.toHaveBeenCalled()
  })
})
