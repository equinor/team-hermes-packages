import Graphic from '@arcgis/core/Graphic'
import Extent from '@arcgis/core/geometry/Extent'
import Point from '@arcgis/core/geometry/Point'
import Polygon from '@arcgis/core/geometry/Polygon'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import type Layer from '@arcgis/core/layers/Layer'
import { describe, expect, it } from 'vite-plus/test'
import { MINIMUM_DIFFERENCE } from './find-bounds'
import { DEFAULT_EXTENT_PADDING, getLayersExtent } from './layers-extent'

const DEFAULT_PADDING_FACTOR = 1 + DEFAULT_EXTENT_PADDING

function pointLayer(latitude: number, longitude: number) {
  return new GraphicsLayer({
    graphics: [new Graphic({ geometry: new Point({ latitude, longitude }) })],
  })
}

function polygonLayer(ring: [longitude: number, latitude: number][]) {
  return new GraphicsLayer({
    graphics: [new Graphic({ geometry: new Polygon({ rings: [ring] }) })],
  })
}

function center(extent: Extent) {
  return {
    x: (extent.xmin + extent.xmax) / 2,
    y: (extent.ymin + extent.ymax) / 2,
  }
}

describe('getLayersExtent', () => {
  it('returns null when there are no layers', () => {
    expect(getLayersExtent([])).toBeNull()
  })

  it('returns null when the layers contain no geometry', () => {
    const empty = new GraphicsLayer()
    const noGeometry = new GraphicsLayer({
      graphics: [new Graphic({ attributes: { name: 'x' } })],
    })
    expect(getLayersExtent([empty, noGeometry])).toBeNull()
  })

  it('builds a padded minimum-size extent around a single point', () => {
    const extent = getLayersExtent([pointLayer(60, 5)])
    expect(extent).not.toBeNull()
    if (!extent) return

    expect(center(extent)).toEqual({ x: 5, y: 60 })
    expect(extent.width).toBeCloseTo(MINIMUM_DIFFERENCE * DEFAULT_PADDING_FACTOR)
    expect(extent.height).toBeCloseTo(MINIMUM_DIFFERENCE * DEFAULT_PADDING_FACTOR)
    expect(extent.spatialReference.isWGS84).toBe(true)
  })

  it('pads a polygon extent by 20% around its center', () => {
    const extent = getLayersExtent([
      polygonLayer([
        [5, 60],
        [7, 60],
        [7, 61],
        [5, 61],
        [5, 60],
      ]),
    ])
    expect(extent).not.toBeNull()
    if (!extent) return

    expect(center(extent)).toEqual({ x: 6, y: 60.5 })
    expect(extent.width).toBeCloseTo(2 * DEFAULT_PADDING_FACTOR)
    expect(extent.height).toBeCloseTo(1 * DEFAULT_PADDING_FACTOR)
  })

  it('uses the padding option instead of the default', () => {
    const layer = polygonLayer([
      [5, 60],
      [7, 60],
      [7, 61],
      [5, 61],
      [5, 60],
    ])

    const extent = getLayersExtent([layer], 0.5)
    expect(extent).not.toBeNull()
    if (!extent) return

    expect(center(extent)).toEqual({ x: 6, y: 60.5 })
    expect(extent.width).toBeCloseTo(2 * 1.5)
    expect(extent.height).toBeCloseTo(1 * 1.5)
  })

  it('adds no padding when padding is 0', () => {
    const layer = polygonLayer([
      [5, 60],
      [7, 60],
      [7, 61],
      [5, 61],
      [5, 60],
    ])

    const extent = getLayersExtent([layer], 0)
    expect(extent).not.toBeNull()
    if (!extent) return

    expect(extent.width).toBeCloseTo(2)
    expect(extent.height).toBeCloseTo(1)
  })

  it('unions geometry across layers and graphics', () => {
    const extent = getLayersExtent([
      pointLayer(58, 4),
      polygonLayer([
        [10, 62],
        [12, 62],
        [12, 64],
        [10, 64],
        [10, 62],
      ]),
    ])
    expect(extent).not.toBeNull()
    if (!extent) return

    expect(center(extent)).toEqual({ x: 8, y: 61 })
    expect(extent.width).toBeCloseTo(8 * DEFAULT_PADDING_FACTOR)
    expect(extent.height).toBeCloseTo(6 * DEFAULT_PADDING_FACTOR)
  })

  it('converts Web Mercator geometry to geographic coordinates', () => {
    const webMercatorPoint = new Point({
      x: 556597.45,
      y: 8399737.89,
      spatialReference: { wkid: 3857 },
    })
    const layer = new GraphicsLayer({
      graphics: [new Graphic({ geometry: webMercatorPoint })],
    })

    const extent = getLayersExtent([layer])
    expect(extent).not.toBeNull()
    if (!extent) return

    expect(center(extent).x).toBeCloseTo(5, 3)
    expect(center(extent).y).toBeCloseTo(60, 3)
    expect(extent.spatialReference.isWGS84).toBe(true)
  })

  it('ignores geometry in unsupported spatial references', () => {
    const utmPoint = new Point({
      x: 500000,
      y: 6650000,
      spatialReference: { wkid: 25833 },
    })
    const layer = new GraphicsLayer({
      graphics: [new Graphic({ geometry: utmPoint })],
    })
    expect(getLayersExtent([layer])).toBeNull()
  })

  it('uses fullExtent for layers that are not GraphicsLayers', () => {
    const fullExtent = new Extent({ xmin: 4, ymin: 58, xmax: 6, ymax: 59 })
    const layer = { fullExtent } as unknown as Layer

    const extent = getLayersExtent([layer])
    expect(extent).not.toBeNull()
    if (!extent) return

    expect(center(extent)).toEqual({ x: 5, y: 58.5 })
    expect(extent.width).toBeCloseTo(2 * DEFAULT_PADDING_FACTOR)
  })
})
