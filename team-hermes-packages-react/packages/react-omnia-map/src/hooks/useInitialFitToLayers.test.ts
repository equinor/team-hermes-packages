import Extent from '@arcgis/core/geometry/Extent'
import Point from '@arcgis/core/geometry/Point'
import Graphic from '@arcgis/core/Graphic'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import type Layer from '@arcgis/core/layers/Layer'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'

import { useInitialFitToLayers } from './useInitialFitToLayers'

function createMapElement() {
  const goTo = vi.fn(() => Promise.resolve())
  const element = {
    view: { goTo },
    viewOnReady: vi.fn(() => Promise.resolve()),
  } as unknown as ArcgisMap
  return { element, goTo }
}

function pointGraphic(latitude: number, longitude: number) {
  return new Graphic({ geometry: new Point({ latitude, longitude }) })
}

function pointLayer(latitude: number, longitude: number) {
  return new GraphicsLayer({ graphics: [pointGraphic(latitude, longitude)] })
}

// A non-GraphicsLayer whose fullExtent only becomes available once `when()` resolves.
function createLoadingLayer() {
  let onLoaded: () => void = () => {}
  const layer = {
    fullExtent: null as Extent | null,
    when: vi.fn((onFulfilled: () => void) => {
      onLoaded = onFulfilled
      return Promise.resolve()
    }),
  }
  return {
    layer: layer as unknown as Layer,
    finishLoading(fullExtent: Extent) {
      layer.fullExtent = fullExtent
      onLoaded()
    },
  }
}

function goToTarget(goTo: ReturnType<typeof vi.fn>): Extent {
  const [options] = goTo.mock.calls[0] as [{ target: Extent }]
  return options.target
}

// Collection 'change' events are dispatched on the microtask queue, so flush after mutating graphics.
const flush = () => act(() => Promise.resolve())

describe('useInitialFitToLayers', () => {
  it('zooms to the layers extent once the view is ready', async () => {
    const { element, goTo } = createMapElement()

    renderHook(() => useInitialFitToLayers(element, [pointLayer(60, 5)]))
    expect(goTo).not.toHaveBeenCalled()

    await flush()
    expect(goTo).toHaveBeenCalledTimes(1)
    const target = goToTarget(goTo)
    expect((target.xmin + target.xmax) / 2).toBeCloseTo(5)
    expect((target.ymin + target.ymax) / 2).toBeCloseTo(60)
  })

  it('zooms again when the map element is replaced', async () => {
    const first = createMapElement()
    const second = createMapElement()
    const layers = [pointLayer(60, 5)]

    const { rerender } = renderHook(({ element }) => useInitialFitToLayers(element, layers), {
      initialProps: { element: first.element },
    })
    await flush()
    expect(first.goTo).toHaveBeenCalledTimes(1)

    rerender({ element: second.element })
    await flush()
    expect(second.goTo).toHaveBeenCalledTimes(1)
    expect(first.goTo).toHaveBeenCalledTimes(1)
  })

  it('waits for layers with geometry to arrive', async () => {
    const { element, goTo } = createMapElement()

    const { rerender } = renderHook(({ layers }) => useInitialFitToLayers(element, layers), {
      initialProps: { layers: [] as GraphicsLayer[] },
    })
    await flush()
    expect(goTo).not.toHaveBeenCalled()

    rerender({ layers: [pointLayer(60, 5)] })
    await flush()
    expect(goTo).toHaveBeenCalledTimes(1)
  })

  it('fits once graphics are added to a layer instance that was empty when the view became ready', async () => {
    const { element, goTo } = createMapElement()
    const layer = new GraphicsLayer()

    renderHook(() => useInitialFitToLayers(element, [layer]))
    await flush()
    expect(goTo).not.toHaveBeenCalled()

    layer.add(pointGraphic(60, 5))
    await flush()
    expect(goTo).toHaveBeenCalledTimes(1)
    const target = goToTarget(goTo)
    expect((target.xmin + target.xmax) / 2).toBeCloseTo(5)
    expect((target.ymin + target.ymax) / 2).toBeCloseTo(60)

    // Fitted once; further graphics on the same instance are ignored.
    layer.add(pointGraphic(70, 20))
    await flush()
    expect(goTo).toHaveBeenCalledTimes(1)
  })

  it('fits once a non-GraphicsLayer finishes loading and exposes its fullExtent', async () => {
    const { element, goTo } = createMapElement()
    // oxlint-disable-next-line typescript/unbound-method -- vi.mock functions do not use `this`
    const { layer, finishLoading } = createLoadingLayer()

    renderHook(() => useInitialFitToLayers(element, [layer]))
    await flush()
    expect(goTo).not.toHaveBeenCalled()

    act(() => finishLoading(new Extent({ xmin: 4, ymin: 58, xmax: 6, ymax: 59 })))
    expect(goTo).toHaveBeenCalledTimes(1)
    const target = goToTarget(goTo)
    expect((target.xmin + target.xmax) / 2).toBeCloseTo(5)
    expect((target.ymin + target.ymax) / 2).toBeCloseTo(58.5)
  })

  it('stops watching empty layers on unmount', async () => {
    const { element, goTo } = createMapElement()
    const layer = new GraphicsLayer()

    const { unmount } = renderHook(() => useInitialFitToLayers(element, [layer]))
    await flush()
    unmount()

    layer.add(pointGraphic(60, 5))
    await flush()
    expect(goTo).not.toHaveBeenCalled()
  })

  it('does not refit when the layers change afterwards', async () => {
    const { element, goTo } = createMapElement()

    const { rerender } = renderHook(({ layers }) => useInitialFitToLayers(element, layers), {
      initialProps: { layers: [pointLayer(60, 5)] },
    })
    await flush()

    rerender({ layers: [pointLayer(70, 20)] })
    await flush()
    expect(goTo).toHaveBeenCalledTimes(1)
  })

  it('fits to the latest layers when they change before the view is ready', async () => {
    const { element, goTo } = createMapElement()
    let resolveReady: () => void = () => {}
    // oxlint-disable-next-line typescript/unbound-method -- vi.mock functions do not use `this`
    vi.mocked(element.viewOnReady).mockImplementation(() => new Promise<void>((resolve) => (resolveReady = resolve)))

    const { rerender } = renderHook(({ layers }) => useInitialFitToLayers(element, layers), {
      initialProps: { layers: [pointLayer(60, 5)] },
    })
    rerender({ layers: [pointLayer(70, 20)] })

    await act(async () => {
      resolveReady()
      await Promise.resolve()
    })

    expect(goTo).toHaveBeenCalledTimes(1)
    const target = goToTarget(goTo)
    expect((target.xmin + target.xmax) / 2).toBeCloseTo(20)
    expect((target.ymin + target.ymax) / 2).toBeCloseTo(70)
  })

  it('does nothing when disabled', async () => {
    const { element, goTo } = createMapElement()

    renderHook(() => useInitialFitToLayers(element, [pointLayer(60, 5)], false))
    await flush()
    expect(goTo).not.toHaveBeenCalled()
  })

  it('does nothing without a map element', async () => {
    renderHook(() => useInitialFitToLayers(null, [pointLayer(60, 5)]))
    await flush()
  })

  it('swallows goTo rejections', async () => {
    const { element, goTo } = createMapElement()
    goTo.mockImplementation(() => Promise.reject(new Error('interrupted')))

    renderHook(() => useInitialFitToLayers(element, [pointLayer(60, 5)]))
    await flush()
    await flush()
    expect(goTo).toHaveBeenCalledTimes(1)
  })
})
