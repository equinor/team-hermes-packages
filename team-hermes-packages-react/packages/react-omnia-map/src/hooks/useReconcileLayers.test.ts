import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import type Layer from '@arcgis/core/layers/Layer'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useReconcileLayers } from './useReconcileLayers'

function createMapElement() {
  const mapLayers: Layer[] = []
  const map = {
    layers: mapLayers,
    addMany: vi.fn((layers: Layer[]) => mapLayers.push(...layers)),
    removeMany: vi.fn((layers: Layer[]) => {
      for (const layer of layers) mapLayers.splice(mapLayers.indexOf(layer), 1)
    }),
  }
  const element = {
    map,
    viewOnReady: vi.fn(() => Promise.resolve()),
  } as unknown as ArcgisMap
  return { element, map, mapLayers }
}

// The hook applies changes after `viewOnReady()` resolves, so flush the microtask queue.
const flush = () => act(() => Promise.resolve())

describe('useReconcileLayers', () => {
  it('does nothing without a map element', async () => {
    const layer = new GraphicsLayer()
    const { result } = renderHook(() => useReconcileLayers(null, [layer]))
    await flush()
    expect(result.current).toBeUndefined()
  })

  it('adds the layers once the view is ready', async () => {
    const { element, map, mapLayers } = createMapElement()
    const a = new GraphicsLayer()
    const b = new GraphicsLayer()

    renderHook(() => useReconcileLayers(element, [a, b]))
    expect(map.addMany).not.toHaveBeenCalled()

    await flush()
    expect(map.addMany).toHaveBeenCalledTimes(1)
    expect(mapLayers).toEqual([a, b])
  })

  it('only adds new and removes missing layers, leaving unchanged instances alone', async () => {
    const { element, map, mapLayers } = createMapElement()
    const a = new GraphicsLayer()
    const b = new GraphicsLayer()
    const c = new GraphicsLayer()

    const { rerender } = renderHook(({ layers }) => useReconcileLayers(element, layers), {
      initialProps: { layers: [a, b] },
    })
    await flush()

    rerender({ layers: [b, c] })
    await flush()

    expect(map.removeMany).toHaveBeenLastCalledWith([a])
    expect(map.addMany).toHaveBeenLastCalledWith([c])
    expect(mapLayers).toEqual([b, c])
  })

  it('moves the layers to the new map when the map element is replaced', async () => {
    const first = createMapElement()
    const second = createMapElement()
    const a = new GraphicsLayer()
    const layers = [a]

    const { rerender } = renderHook(({ element }) => useReconcileLayers(element, layers), {
      initialProps: { element: first.element },
    })
    await flush()
    expect(first.mapLayers).toEqual([a])

    rerender({ element: second.element })
    await flush()

    expect(first.mapLayers).toEqual([])
    expect(second.mapLayers).toEqual([a])
  })

  it('treats a new array with the same instances as a no-op', async () => {
    const { element, map } = createMapElement()
    const a = new GraphicsLayer()

    const { rerender } = renderHook(({ layers }) => useReconcileLayers(element, layers), {
      initialProps: { layers: [a] },
    })
    await flush()

    rerender({ layers: [a] })
    await flush()

    expect(map.addMany).toHaveBeenCalledTimes(1)
    expect(map.removeMany).not.toHaveBeenCalled()
  })

  it('removes every applied layer on unmount', async () => {
    const { element, mapLayers } = createMapElement()
    const a = new GraphicsLayer()
    const b = new GraphicsLayer()

    const { unmount } = renderHook(() => useReconcileLayers(element, [a, b]))
    await flush()
    expect(mapLayers).toEqual([a, b])

    unmount()
    expect(mapLayers).toEqual([])
  })

  it('applies only the latest layers when they change before the view is ready', async () => {
    const { element, map, mapLayers } = createMapElement()
    let resolveReady: () => void = () => {}
    // oxlint-disable-next-line typescript/unbound-method -- vi.mock functions do not use `this`
    vi.mocked(element.viewOnReady).mockImplementation(() => new Promise<void>((resolve) => (resolveReady = resolve)))
    const a = new GraphicsLayer()
    const b = new GraphicsLayer()

    const { rerender } = renderHook(({ layers }) => useReconcileLayers(element, layers), {
      initialProps: { layers: [a] },
    })
    rerender({ layers: [b] })

    await act(async () => {
      resolveReady()
      await Promise.resolve()
    })

    expect(map.addMany).toHaveBeenCalledTimes(1)
    expect(mapLayers).toEqual([b])
  })
})
