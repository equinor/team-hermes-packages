import '@/initialize-arcgis-components'
import type Point from '@arcgis/core/geometry/Point'
import type Layer from '@arcgis/core/layers/Layer'
import type { ClickEvent, LayerViewCreateEvent } from '@arcgis/core/views/input/types'
import type { GraphicHit } from '@arcgis/core/views/types'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import type { TargetedEvent } from '@esri/calcite-components'
import type { JSX, Ref } from 'react'
import { useRef } from 'react'

import { backingMapKey } from '@/helpers/backing-map-key'
import { resolveInitialFitLayers } from '@/helpers/initial-fit-layers'
import { useForwardedElementState } from '@/hooks/useForwardedElementState'
import { useInitialFitToLayers } from '@/hooks/useInitialFitToLayers'
import { useReconcileLayers } from '@/hooks/useReconcileLayers'

type ArcgisMapElementProps = JSX.IntrinsicElements['arcgis-map']

export type OmniaMapProps = Omit<ArcgisMapElementProps, 'ref'> & {
  /**
   * Layers owned by the consumer, shown on top of the web map. Layers are added and removed by identity, so
   * memoize the array and reuse layer instances across renders. Draw order follows insertion order: a layer keeps
   * its position for as long as it stays in the array, and reordering the array has no effect.
   */
  layers?: readonly Layer[]
  /**
   * Zoom to the extent of `layers` once per map, the first time its view is ready and the layers contain any
   * geometry. Overrides `center`/`zoom`/`extent` at that point. Pass a subset of `layers` to fit to those only, e.g.
   * to leave wide reference layers (such as a FeatureLayer covering a whole region) out of the fit. Defaults to true.
   */
  initialFitToLayers?: boolean | readonly Layer[]
  /**
   * Hide the web map's own operational layers (the basemap stays visible), leaving only `layers`. Applied to each
   * layer once, when its layer view is created, so toggling it after load has no effect. Defaults to false.
   */
  hideWebMapLayers?: boolean
  /** Called with the map point of every click on the view. */
  onMapClick?: (mapPoint: Point, event: ClickEvent) => void
  /** Called on every click with the topmost layer from `layers` under the pointer, or null when none was hit. */
  onLayerClick?: (layer: Layer | null, hit: GraphicHit | null) => void
  ref?: Ref<ArcgisMap>
}

const NO_LAYERS: readonly Layer[] = []

/**
 * A thin React wrapper around <arcgis-map>. Accepts every <arcgis-map> prop and child, and adds reactive `layers`.
 * Changing `itemId` or `map` remounts the element, so the hooks and `layers` start over on the new map.
 * Authentication is not handled here: for private web maps, gate rendering in your own wrapper using
 * OmniaMapsAuthContextProvider and useOmniaMapsAuth().
 */
export function OmniaMap({
  layers = NO_LAYERS,
  initialFitToLayers = true,
  hideWebMapLayers = false,
  onMapClick,
  onLayerClick,
  ref,
  children,
  ...arcgisMapProps
}: OmniaMapProps) {
  const [mapElement, mapElementRef] = useForwardedElementState(ref)
  const latestClick = useRef(0)
  const fitLayers = resolveInitialFitLayers(layers, initialFitToLayers)

  useReconcileLayers(mapElement, layers)
  useInitialFitToLayers(mapElement, fitLayers ?? NO_LAYERS, fitLayers !== null)

  function handleLayerviewCreate(event: TargetedEvent<ArcgisMap, LayerViewCreateEvent>) {
    arcgisMapProps.onarcgisViewLayerviewCreate?.(event)
    if (!hideWebMapLayers) return
    const { layer } = event.detail
    const isOperationalLayer = event.target.map?.layers.includes(layer) ?? false
    if (isOperationalLayer && !layers.includes(layer)) layer.visible = false
  }

  async function handleViewClick(event: TargetedEvent<ArcgisMap, ClickEvent>) {
    arcgisMapProps.onarcgisViewClick?.(event)
    onMapClick?.(event.detail.mapPoint, event.detail)

    if (!onLayerClick) return
    const click = ++latestClick.current
    if (layers.length === 0) {
      onLayerClick(null, null)
      return
    }
    let response
    try {
      response = await event.target.hitTest(event.detail, { include: layers })
    } catch {
      // The view was destroyed or replaced between the click and the result.
      return
    }
    // A newer click supersedes this one, so results are reported in click order.
    if (click !== latestClick.current) return
    const hit = response.results.find((result): result is GraphicHit => result.type === 'graphic')
    const layer = hit ? (layers.find((candidate) => candidate === hit.graphic.layer) ?? null) : null
    onLayerClick(layer, hit ?? null)
  }

  return (
    <arcgis-map
      {...arcgisMapProps}
      key={backingMapKey(arcgisMapProps)}
      ref={mapElementRef}
      onarcgisViewLayerviewCreate={handleLayerviewCreate}
      onarcgisViewClick={handleViewClick}
    >
      {children}
    </arcgis-map>
  )
}
