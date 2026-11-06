import Collection from '@arcgis/core/core/Collection'
import Point from '@arcgis/core/geometry/Point'
import Graphic from '@arcgis/core/Graphic'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import type Layer from '@arcgis/core/layers/Layer'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'

import { useLayerHighlight } from './useLayerHighlight'

function createMapElement() {
  const removeHighlight = vi.fn()
  const highlight = vi.fn(() => ({ remove: removeHighlight }))
  const layerView = { highlight }
  const whenLayerView = vi.fn(() => Promise.resolve(layerView))
  // By default every layer counts as being on the map.
  const view = { map: { layers: { includes: () => true } as unknown as Collection<Layer> } }
  const element = { whenLayerView, viewOnReady: () => Promise.resolve(), view } as unknown as ArcgisMap
  return { element, view, whenLayerView, highlight, removeHighlight }
}

function pointGraphic(latitude: number, longitude: number) {
  return new Graphic({ geometry: new Point({ latitude, longitude }) })
}

// The hook waits on several promises before the layer view is requested.
const flush = async () => {
  for (let i = 0; i < 5; i++) await act(() => Promise.resolve())
}

describe('useLayerHighlight', () => {
  it('highlights every graphic of each layer once the layer view exists', async () => {
    const { element, whenLayerView, highlight } = createMapElement()
    const a = new GraphicsLayer({ graphics: [pointGraphic(60, 5), pointGraphic(61, 6)] })
    const b = new GraphicsLayer({ graphics: [pointGraphic(62, 7)] })

    renderHook(() => useLayerHighlight(element, [a, b]))
    await flush()

    expect(whenLayerView).toHaveBeenCalledWith(a)
    expect(whenLayerView).toHaveBeenCalledWith(b)
    expect(highlight).toHaveBeenCalledTimes(2)
    expect(highlight).toHaveBeenCalledWith(a.graphics.toArray())
    expect(highlight).toHaveBeenCalledWith(b.graphics.toArray())
  })

  it('re-applies the highlight when a layer’s graphics change', async () => {
    const { element, highlight, removeHighlight } = createMapElement()
    const layer = new GraphicsLayer({ graphics: [pointGraphic(60, 5)] })

    renderHook(() => useLayerHighlight(element, [layer]))
    await flush()
    expect(highlight).toHaveBeenCalledTimes(1)

    // Collection 'change' events are dispatched on the microtask queue, not synchronously on add().
    await act(async () => {
      layer.add(pointGraphic(61, 6))
      await Promise.resolve()
    })

    expect(removeHighlight).toHaveBeenCalledTimes(1)
    expect(highlight).toHaveBeenCalledTimes(2)
    expect(highlight).toHaveBeenLastCalledWith(layer.graphics.toArray())
  })

  it('waits for the layer to be added to the map before requesting its layer view', async () => {
    const { element, view, whenLayerView, highlight } = createMapElement()
    const mapLayers = new Collection<Layer>()
    view.map.layers = mapLayers
    const layer = new GraphicsLayer({ graphics: [pointGraphic(60, 5)] })

    renderHook(() => useLayerHighlight(element, [layer]))
    await flush()
    expect(whenLayerView).not.toHaveBeenCalled()

    mapLayers.add(layer)
    await flush()
    expect(whenLayerView).toHaveBeenCalledWith(layer)
    expect(highlight).toHaveBeenCalledTimes(1)
  })

  it('removes the highlight and stops listening on unmount', async () => {
    const { element, highlight, removeHighlight } = createMapElement()
    const layer = new GraphicsLayer({ graphics: [pointGraphic(60, 5)] })

    const { unmount } = renderHook(() => useLayerHighlight(element, [layer]))
    await flush()

    unmount()
    expect(removeHighlight).toHaveBeenCalledTimes(1)

    await act(async () => {
      layer.add(pointGraphic(61, 6))
      await Promise.resolve()
    })
    expect(highlight).toHaveBeenCalledTimes(1)
  })

  it('removes the old highlight when the highlighted layers change', async () => {
    const { element, highlight, removeHighlight } = createMapElement()
    const a = new GraphicsLayer({ graphics: [pointGraphic(60, 5)] })
    const b = new GraphicsLayer({ graphics: [pointGraphic(61, 6)] })

    const { rerender } = renderHook(({ layers }) => useLayerHighlight(element, layers), {
      initialProps: { layers: [a] },
    })
    await flush()

    rerender({ layers: [b] })
    await flush()

    expect(removeHighlight).toHaveBeenCalledTimes(1)
    expect(highlight).toHaveBeenLastCalledWith(b.graphics.toArray())
  })

  it('does not apply a highlight that resolves after unmount', async () => {
    const { element, whenLayerView, highlight } = createMapElement()
    let resolveLayerView: () => void = () => {}
    whenLayerView.mockImplementation(() => new Promise((resolve) => (resolveLayerView = () => resolve({ highlight }))))
    const layer = new GraphicsLayer({ graphics: [pointGraphic(60, 5)] })

    const { unmount } = renderHook(() => useLayerHighlight(element, [layer]))
    await flush()
    unmount()

    await act(async () => {
      resolveLayerView()
      await Promise.resolve()
    })
    expect(highlight).not.toHaveBeenCalled()
  })

  it('ignores layers that are not GraphicsLayers', async () => {
    const { element, whenLayerView } = createMapElement()
    const other = { id: 'tiles' } as unknown as Layer

    renderHook(() => useLayerHighlight(element, [other]))
    await flush()
    expect(whenLayerView).not.toHaveBeenCalled()
  })

  it('does nothing without a map element or without layers', async () => {
    const { element, whenLayerView } = createMapElement()

    renderHook(() => useLayerHighlight(null, [new GraphicsLayer()]))
    renderHook(() => useLayerHighlight(element, []))
    await flush()
    expect(whenLayerView).not.toHaveBeenCalled()
  })

  it('swallows whenLayerView rejections', async () => {
    const { element, whenLayerView, highlight } = createMapElement()
    whenLayerView.mockImplementation(() => Promise.reject(new Error('layer removed')))

    renderHook(() => useLayerHighlight(element, [new GraphicsLayer({ graphics: [pointGraphic(60, 5)] })]))
    await flush()
    await flush()
    expect(highlight).not.toHaveBeenCalled()
  })
})
