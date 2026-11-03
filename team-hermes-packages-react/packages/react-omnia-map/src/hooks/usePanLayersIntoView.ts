import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import type Layer from '@arcgis/core/layers/Layer'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { useEffect } from 'react'

// Waits for the pointer to rest on a row, so scrolling or sweeping across a table doesn't pan the map.
const DEFAULT_PAN_DELAY_MS = 300

type PanLayersIntoViewOptions = {
  /** How long `layers` must stay unchanged before panning. Defaults to 300 ms. */
  delayMs?: number
}

/**
 * Pans the view (keeping the current scale) so the graphics in `layers` become visible, unless any of them already
 * are. Only GraphicsLayers are considered. Memoize `layers`, as every change restarts the delay.
 */
export function usePanLayersIntoView(
  mapElement: ArcgisMap | null,
  layers: readonly Layer[],
  { delayMs = DEFAULT_PAN_DELAY_MS }: PanLayersIntoViewOptions = {}
) {
  useEffect(() => {
    if (!mapElement || layers.length === 0) return
    const timeout = setTimeout(() => {
      const view = mapElement.view
      if (!view?.ready) return

      const graphics = layers.flatMap((layer) => (layer instanceof GraphicsLayer ? layer.graphics.toArray() : []))
      const isInView = graphics.some((graphic) => graphic.geometry && view.extent.intersects(graphic.geometry))
      if (graphics.length === 0 || isInView) return
      // goTo rejects when a newer goTo or user interaction interrupts it.
      view.goTo({ target: graphics, scale: view.scale }).catch(() => {})
    }, delayMs)
    return () => clearTimeout(timeout)
  }, [mapElement, layers, delayMs])
}
