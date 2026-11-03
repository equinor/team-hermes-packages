import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import type Layer from '@arcgis/core/layers/Layer'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { useEffect, useRef } from 'react'
import { getLayersExtent } from '../helpers/layers-extent'

const noop = () => {}

/**
 * Zooms the view to the extent of `layers` exactly once: the first time the view is ready *and* the layers contain
 * any geometry, whichever comes last. Layer instances that are still empty when the view becomes ready are watched
 * (graphics for GraphicsLayers, load completion for other layers) until the first usable extent appears.
 * Later changes to `layers` do not move the view.
 */
export function useInitialFitToLayers(mapElement: ArcgisMap | null, layers: readonly Layer[], enabled = true) {
  const hasFitted = useRef(false)

  useEffect(() => {
    if (!enabled || hasFitted.current || !mapElement) return
    let canceled = false
    const stopWatching: (() => void)[] = []

    const fitIfPossible = () => {
      if (canceled || hasFitted.current) return
      const extent = getLayersExtent(layers)
      if (!extent) return
      hasFitted.current = true
      for (const stop of stopWatching) stop()
      // goTo rejects when a newer goTo or user interaction interrupts it.
      mapElement.view.goTo({ target: extent }).catch(() => {})
    }

    // viewOnReady rejects when the map fails to load; consumers observe that via arcgisLoadError.
    void mapElement.viewOnReady().then(() => {
      if (canceled) return
      fitIfPossible()
      if (hasFitted.current) return

      // No geometry yet: wait for it to arrive on the current layer instances.
      for (const layer of layers) {
        if (layer instanceof GraphicsLayer) {
          const handle = layer.graphics.on('change', fitIfPossible)
          stopWatching.push(() => handle.remove())
        } else {
          // fullExtent is populated once the layer has loaded. Load errors are the consumer's to handle.
          void layer.when(fitIfPossible, noop)
        }
      }
    }, noop)

    return () => {
      canceled = true
      for (const stop of stopWatching) stop()
    }
  }, [mapElement, layers, enabled])
}
