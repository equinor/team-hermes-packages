import type Layer from '@arcgis/core/layers/Layer'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { useEffect, useRef } from 'react'

const noop = () => {}

/**
 * Keeps the map's operational layers in sync with `layers`: layers are added and removed by identity, so an
 * unchanged layer instance is left untouched when siblings come and go. Memoize `layers` to avoid churn.
 */
export function useReconcileLayers(mapElement: ArcgisMap | null, layers: readonly Layer[]) {
  const appliedLayers = useRef<readonly Layer[]>([])

  useEffect(() => {
    if (!mapElement) return
    let canceled = false

    // viewOnReady rejects when the map fails to load; consumers observe that via arcgisLoadError.
    void mapElement.viewOnReady().then(() => {
      const map = mapElement.map
      if (canceled || !map) return
      const removed = appliedLayers.current.filter((layer) => !layers.includes(layer))
      const added = layers.filter((layer) => !appliedLayers.current.includes(layer))
      if (removed.length > 0) map.removeMany(removed)
      if (added.length > 0) map.addMany(added)
      appliedLayers.current = layers
    }, noop)

    return () => {
      canceled = true
    }
  }, [mapElement, layers])

  useEffect(
    () => () => {
      mapElement?.map?.removeMany([...appliedLayers.current])
      appliedLayers.current = []
    },
    [mapElement]
  )
}
