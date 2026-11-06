import Extent from '@arcgis/core/geometry/Extent'
import Point from '@arcgis/core/geometry/Point'
import { webMercatorToGeographic } from '@arcgis/core/geometry/support/webMercatorUtils'
import type { GeometryUnion } from '@arcgis/core/geometry/types'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import type Layer from '@arcgis/core/layers/Layer'

import { findBounds } from './find-bounds'

type LatLong = [latitude: number, longitude: number]

// Expand the extent by 20% to add some padding around the layers' contents
export const DEFAULT_EXTENT_PADDING = 0.2

// Only WGS84 and Web Mercator geometries are supported; other spatial references are ignored.
function geometryCorners(geometry: GeometryUnion): LatLong[] {
  const geographic = geometry.spatialReference?.isWebMercator ? webMercatorToGeographic(geometry) : geometry
  if (!geographic?.spatialReference?.isWGS84) return []

  if (geographic instanceof Point) return [[geographic.y, geographic.x]]
  const extent = geographic.extent
  if (!extent) return []
  return [
    [extent.ymin, extent.xmin],
    [extent.ymax, extent.xmax],
  ]
}

function layerCorners(layer: Layer): LatLong[] {
  if (layer instanceof GraphicsLayer) {
    return layer.graphics.toArray().flatMap((graphic) => (graphic.geometry ? geometryCorners(graphic.geometry) : []))
  }
  return layer.fullExtent ? geometryCorners(layer.fullExtent) : []
}

/**
 * The padded WGS84 extent covering everything in `layers`: every graphic of a GraphicsLayer, or `fullExtent`
 * for other layer types. Returns null when the layers contain no geometry.
 *
 * `padding` is the fraction added around the contents: 0.2 (the default) grows the width and height by 20%.
 */
export function getLayersExtent(layers: readonly Layer[], padding = DEFAULT_EXTENT_PADDING): Extent | null {
  const corners = layers.flatMap(layerCorners)
  if (corners.length === 0) return null

  const bounds = findBounds(corners)
  return new Extent({
    xmin: bounds.minLongitude,
    ymin: bounds.minLatitude,
    xmax: bounds.maxLongitude,
    ymax: bounds.maxLatitude,
  }).expand(1 + padding)
}
