import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { OmniaMap, type OmniaMapProps } from '../OmniaMap/OmniaMap'
import { useViewExtentLayer } from '../../hooks/useViewExtentLayer'
import { useForwardedElementState } from '../../hooks/useForwardedElementState'
import { useMemo, useState } from 'react'
import { useFollowView } from '../../hooks/useFollowView'
import MapViewConstraints from '@arcgis/core/views/2d/MapViewConstraints'
import type { SimpleLineSymbolProperties } from '@arcgis/core/symbols/SimpleLineSymbol'

type OmniaMiniMapProps = Omit<
  OmniaMapProps,
  'layers' | 'initialFitToLayers' | 'center' | 'zoom' | 'scale' | 'extent'
> & {
  /** The `<arcgis-map>` element representing the main map (from its ref) */
  mainMap: ArcgisMap | null
  /** The zoom offset relative to the main map. Defaults to 5. */
  zoomOffset?: number
  /** The symbol used to represent the extent outline on the mini map, defaulting to a translucent blue line. */
  extentSymbol?: SimpleLineSymbolProperties
}

const DEFAULT_ZOOM_OFFSET = 5

/**
 * A small, non-interactive overview map, which follows the provided `mainMap`.
 * It follows the view of the main map, applying the specified `zoomOffset` to determine its scale
 * (but never zooms further out than the whole world).
 */
export function OmniaMiniMap({
  mainMap,
  zoomOffset = DEFAULT_ZOOM_OFFSET,
  extentSymbol,
  className,
  ref,
  ...omniaMapProps
}: OmniaMiniMapProps) {
  const [miniMap, miniMapRef] = useForwardedElementState(ref)
  const extentLayer = useViewExtentLayer(mainMap, extentSymbol)
  const layers = useMemo(() => [extentLayer], [extentLayer])
  useFollowView(miniMap, mainMap, zoomOffset)

  // `lods: []` disables the basemap's LOD-based minimum scale and zoom snapping, so any scale can be set.
  // Verified against @arcgis/core 5.1.27: MapViewConstraints only falls back to the map's LODs when `lods` is nullish.
  const [constraints] = useState(() => new MapViewConstraints({ lods: [], snapToZoom: false, rotationEnabled: false }))

  return (
    <OmniaMap
      constraints={constraints}
      hideWebMapLayers
      {...omniaMapProps}
      ref={miniMapRef}
      // The [:where(&)]: prefix reduces CSS specificity, so that any provided className can override these styles if needed, without the use of !important.
      className={['[:where(&)]:pointer-events-none [:where(&)]:bg-white', className].filter(Boolean).join(' ')}
      initialFitToLayers={false}
      wrap=""
      layers={layers}
    />
  )
}
