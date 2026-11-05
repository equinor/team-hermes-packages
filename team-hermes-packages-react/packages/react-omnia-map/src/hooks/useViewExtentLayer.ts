import { watch } from '@arcgis/core/core/reactiveUtils'
import Polyline from '@arcgis/core/geometry/Polyline'
import Graphic from '@arcgis/core/Graphic'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import type { SimpleLineSymbolProperties } from '@arcgis/core/symbols/SimpleLineSymbol'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { useEffect, useState } from 'react'
import { WORLD_WIDTH_METERS } from '../helpers/world-extent'

const DEFAULT_SYMBOL: SimpleLineSymbolProperties = { color: '#0044ff80', width: 2, join: 'round' } as const
const noop = () => {}

/**
 * A stable GraphicsLayer with one graphic that mirrors the extent of `mapElement`'s view, in the view's spatial
 * reference. The graphic is updated in place on every view change, so the layer never flashes and the hook never
 * re-renders. Used primarily for displaying the current view extent on a minimap.
 */
export function useViewExtentLayer(
  mapElement: ArcgisMap | null,
  symbol: SimpleLineSymbolProperties = DEFAULT_SYMBOL
): GraphicsLayer {
  const [graphic] = useState(() => new Graphic({ symbol: { ...symbol, type: 'simple-line' } }))
  const [layer] = useState(() => new GraphicsLayer({ title: 'View extent', graphics: [graphic], listMode: 'hide' }))

  // Update the graphic's symbol whenever it changes
  useEffect(() => {
    graphic.symbol = { ...symbol, type: 'simple-line' }
  }, [graphic, symbol])

  // Update the graphic's geometry whenever the map's view extent changes.
  // If two updates happen in quick succession, the previous watch is canceled before setting up a new one.
  useEffect(() => {
    if (!mapElement) {
      graphic.geometry = null
      return
    }
    let canceled = false
    let handle: { remove: () => void } | null = null

    void mapElement.viewOnReady().then(() => {
      if (canceled) return
      handle = watch(
        () => mapElement.view.extent,
        (extent) => {
          if (!extent) {
            graphic.geometry = null
            return
          }
          const { ymin, ymax } = extent
          const width = Math.min(extent.width, WORLD_WIDTH_METERS)
          const xmin = extent.center.x - width / 2
          const xmax = extent.center.x + width / 2
          graphic.geometry = extent
            ? new Polyline({
                paths: [
                  [
                    [xmin, ymin],
                    [xmin, ymax],
                    [xmax, ymax],
                    [xmax, ymin],
                    [xmin, ymin],
                  ],
                ],
                spatialReference: extent.spatialReference,
              })
            : null
        }
      )
    }, noop)
    return () => {
      canceled = true
      handle?.remove()
    }
  }, [mapElement, graphic])

  return layer
}
