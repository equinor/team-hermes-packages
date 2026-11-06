import { isAbortError } from '@arcgis/core/core/promiseUtils'
import { getNearestCoordinate } from '@arcgis/core/geometry/operators/proximityOperator'
import type Point from '@arcgis/core/geometry/Point'
import { geographicToWebMercator, webMercatorToGeographic } from '@arcgis/core/geometry/support/webMercatorUtils'
import type { GeometryUnion } from '@arcgis/core/geometry/types'
import type Graphic from '@arcgis/core/Graphic'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { useEffect } from 'react'

type PointerType = 'mouse' | 'pen' | 'touch'

function pointerTypeOf(native: PointerEvent | MouseEvent): PointerType {
  const type = 'pointerType' in native ? native.pointerType : 'mouse'
  return type === 'pen' || type === 'touch' ? type : 'mouse'
}

// Brings `geometry` into the point's spatial reference when they differ between WGS84 and Web Mercator.
function inSpatialReferenceOf(point: Point, geometry: GeometryUnion): GeometryUnion | null {
  const target = point.spatialReference
  const source = geometry.spatialReference
  if (!target || !source || target.equals(source)) return geometry
  if (target.isWebMercator && source.isWGS84) return geographicToWebMercator(geometry)
  if (target.isWGS84 && source.isWebMercator) return webMercatorToGeographic(geometry)
  return null
}

/**
 * Planar distance from `point` to the graphic's geometry, or Infinity when it cannot be measured. For polygons this is
 * the distance to the outline, also from the inside: a click inside a large area is "near" the area's edge, not the
 * area itself, so points and lines under the pointer rank ahead of the areas surrounding them.
 */
export function distanceToGraphic(point: Point, graphic: Graphic): number {
  if (!graphic.geometry) return Number.POSITIVE_INFINITY
  const geometry = inSpatialReferenceOf(point, graphic.geometry)
  if (!geometry) {
    console.warn('Cannot rank popup feature in an unsupported spatial reference.', graphic)
    return Number.POSITIVE_INFINITY
  }
  try {
    return getNearestCoordinate(geometry, point, { testPolygonInterior: false }).distance
  } catch (error) {
    console.warn('Cannot measure distance to popup feature.', error)
    return Number.POSITIVE_INFINITY
  }
}

/** The graphics ordered by distance to `point`, closest first. Ties keep their original (layer) order. */
export function sortByDistanceTo(point: Point, graphics: readonly Graphic[]): Graphic[] {
  return graphics
    .map((graphic, index) => ({ graphic, index, distance: distanceToGraphic(point, graphic) }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .map(({ graphic }) => graphic)
}

/**
 * Opens the popup with the clicked features ordered by distance to the click, closest first, instead of by layer
 * order. Polygons are measured to their outline, so a point or line under the pointer ranks ahead of the areas it
 * lies in. The features are the same ones the default popup would show. Takes over popup opening on click for as
 * long as it is enabled; `openPopup()` and other widgets keep working.
 */
export function useNearestFirstPopup(mapElement: ArcgisMap | null, enabled = true) {
  useEffect(() => {
    if (!mapElement || !enabled) return
    let canceled = false
    let clickHandle: { remove: () => void } | undefined
    let pending: AbortController | undefined
    let restorePopup: (() => void) | undefined

    // viewOnReady rejects when the map fails to load; consumers observe that via arcgisLoadError.
    void mapElement.viewOnReady().then(
      () => {
        if (canceled) return
        const view = mapElement.view
        const previousPopupEnabled = view.popupEnabled
        restorePopup = () => {
          view.popupEnabled = previousPopupEnabled
        }
        view.popupEnabled = false

        clickHandle = view.on('click', (event) => {
          pending?.abort()
          const controller = new AbortController()
          pending = controller

          void (async () => {
            const features: Graphic[] = []
            try {
              const generator = view.fetchPopupFeatures(
                { x: event.x, y: event.y },
                { pointerType: pointerTypeOf(event.native), signal: controller.signal }
              )
              for await (const feature of generator) features.push(feature)
            } catch (error) {
              if (!controller.signal.aborted && !isAbortError(error)) {
                console.error('Cannot fetch popup features.', error)
              }
              return
            }
            if (controller.signal.aborted) return
            if (features.length === 0) {
              view.closePopup()
              return
            }
            try {
              await view.openPopup({ features: sortByDistanceTo(event.mapPoint, features), location: event.mapPoint })
            } catch (error) {
              if (!controller.signal.aborted && !isAbortError(error)) {
                console.error('Cannot open nearest-first popup.', error)
              }
            }
          })()
        })
      },
      (error) => {
        if (!canceled && !isAbortError(error)) console.error('Cannot initialize nearest-first popup.', error)
      }
    )

    return () => {
      canceled = true
      pending?.abort()
      clickHandle?.remove()
      restorePopup?.()
    }
  }, [mapElement, enabled])
}
