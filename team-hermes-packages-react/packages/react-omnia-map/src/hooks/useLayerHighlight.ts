import type { ResourceHandle } from '@arcgis/core/core/Handles'
import { whenOnce } from '@arcgis/core/core/reactiveUtils'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import type Layer from '@arcgis/core/layers/Layer'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { useEffect } from 'react'

/**
 * Highlights every graphic in each of `layers` using the view's highlight style, and re-applies the highlight when a
 * layer's graphics collection changes. Only GraphicsLayers are highlighted. Memoize `layers` to avoid flicker.
 */
export function useLayerHighlight(mapElement: ArcgisMap | null, layers: readonly Layer[]) {
  useEffect(() => {
    if (!mapElement || layers.length === 0) return
    let canceled = false
    const abortController = new AbortController()
    const cleanups: (() => void)[] = []

    for (const layer of layers) {
      if (!(layer instanceof GraphicsLayer)) continue
      // whenLayerView rejects for layers that are not on the map yet, and OmniaMap adds its layers once the view is ready.
      mapElement
        .viewOnReady()
        .then(() => whenOnce(() => mapElement.view.map?.layers.includes(layer), abortController.signal))
        .then(() => mapElement.whenLayerView(layer))
        .then((layerView) => {
          if (canceled) return
          let highlight: ResourceHandle | undefined
          const applyHighlight = () => {
            highlight?.remove()
            highlight = layerView.highlight(layer.graphics.toArray())
          }
          applyHighlight()
          const graphicsChange = layer.graphics.on('change', applyHighlight)
          cleanups.push(() => {
            graphicsChange.remove()
            highlight?.remove()
          })
        })
        // Rejects when the layer is removed before its view is created, or when the wait is aborted.
        .catch(() => {})
    }

    return () => {
      canceled = true
      abortController.abort()
      for (const cleanup of cleanups) cleanup()
    }
  }, [mapElement, layers])
}
