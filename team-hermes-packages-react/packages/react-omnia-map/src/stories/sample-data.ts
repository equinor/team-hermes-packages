import Color from '@arcgis/core/Color'
import Point from '@arcgis/core/geometry/Point'
import Graphic from '@arcgis/core/Graphic'
import FeatureLayer from '@arcgis/core/layers/FeatureLayer'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import type { FieldType } from '@arcgis/core/layers/support/types'
import FieldInfoFormat from '@arcgis/core/popup/support/FieldInfoFormat'
import type { RendererUnion } from '@arcgis/core/renderers/types'
import type { SymbolUnion } from '@arcgis/core/unionTypes'

export type Place = { name: string; longitude: number; latitude: number }

export const NORWEGIAN_CITIES: Place[] = [
  { name: 'Oslo', longitude: 10.75, latitude: 59.91 },
  { name: 'Bergen', longitude: 5.32, latitude: 60.39 },
  { name: 'Stavanger', longitude: 5.73, latitude: 58.97 },
  { name: 'Trondheim', longitude: 10.4, latitude: 63.43 },
  { name: 'Tromsø', longitude: 18.96, latitude: 69.65 },
]

export const US_CITIES: Place[] = [
  { name: 'Houston', longitude: -95.37, latitude: 29.76 },
  { name: 'Denver', longitude: -104.99, latitude: 39.74 },
  { name: 'Chicago', longitude: -87.63, latitude: 41.88 },
  { name: 'New York', longitude: -74.0, latitude: 40.71 },
]

export function createPlacesLayer(places: Place[], { title = 'Places', color = '#007079' } = {}) {
  return new GraphicsLayer({
    title,
    graphics: places.map(
      ({ name, longitude, latitude }) =>
        new Graphic({
          geometry: new Point({ longitude, latitude }),
          attributes: { name },
          symbol: {
            type: 'simple-marker',
            color,
            size: 12,
            outline: { color: 'white', width: 1.5 },
          },
        })
    ),
  })
}

// Public FactMaps service from the Norwegian Offshore Directorate (Sodir), published in ED50 / UTM 32N. ArcGIS Server
// reprojects to the view's spatial reference per request. No sign-in needed.
const SODIR_FACTMAPS = 'https://factmaps.sodir.no/api/rest/services/Factmaps/FactMapsED50UTM32/MapServer'

type SodirLayer = { id: number; title: string; popupTitle?: string }
type SodirGroup = { title: string; layers: SodirLayer[] }

// Selected layers from Sodir's tree, with area layers below lines and points.
const SODIR_GROUPS: SodirGroup[] = [
  {
    title: 'Borders and areas',
    layers: [
      { id: 805, title: 'Area status' },
      { id: 804, title: 'Sub areas' },
      { id: 803, title: 'Quadrants', popupTitle: 'Quadrant {qadName}' },
      { id: 809, title: 'Quadrants (SBM)', popupTitle: 'Quadrant {quadName}' },
      { id: 802, title: 'Blocks', popupTitle: 'Block {blcName}' },
      { id: 807, title: 'Blocks (SBM)', popupTitle: 'Block {blcName}' },
    ],
  },
  {
    title: 'Hydrocarbon',
    layers: [
      { id: 540, title: 'Plays' },
      { id: 504, title: 'Discovery, all - by main HC type' },
      { id: 505, title: 'Discovery, history - by HC type' },
      { id: 503, title: 'Discovery, active - by HC type' },
    ],
  },
  {
    title: 'Licencing',
    layers: [
      { id: 614, title: 'Production licence, all - current by operator' },
      { id: 658, title: 'Licence - Documents' },
    ],
  },
  {
    title: 'Facilities and pipelines',
    layers: [
      { id: 311, title: 'Pipelines' },
      { id: 304, title: 'Facilities, in place' },
    ],
  },
  {
    title: 'Wellbores',
    layers: [
      { id: 201, title: 'Wellbores, all' },
      { id: 207, title: 'CO2-storage wellbores' },
    ],
  },
]

const SODIR_LAYERS = SODIR_GROUPS.flatMap(({ title: group, layers }) =>
  layers.map((layer) => ({ ...layer, title: `${group} / ${layer.title}` }))
)

/** Titles of the layers from `createSodirReferenceLayers`, in the same order. */
export const SODIR_REFERENCE_LAYER_TITLES = SODIR_LAYERS.map((layer) => layer.title)

// Sodir's integer fields are years, NPDIDs, block numbers and the like, which should not get a digit separator.
const INTEGER_FIELD_TYPES = new Set<FieldType>(['small-integer', 'integer', 'big-integer', 'long', 'oid'])

// Some of Sodir's polygon layers use fully opaque fills, which hide the basemap and your own layers underneath.
const MAX_FILL_ALPHA = 0.5

function rendererSymbols(renderer: RendererUnion): SymbolUnion[] {
  const symbols: (SymbolUnion | null | undefined)[] = []
  switch (renderer.type) {
    case 'simple':
      symbols.push(renderer.symbol)
      break
    case 'unique-value':
      symbols.push(
        renderer.defaultSymbol,
        ...(renderer.uniqueValueGroups ?? []).flatMap((group) => (group.classes ?? []).map((cls) => cls.symbol)),
        ...(renderer.uniqueValueInfos ?? []).map((info) => info.symbol)
      )
      break
    case 'class-breaks':
      symbols.push(renderer.defaultSymbol, ...renderer.classBreakInfos.map((info) => info.symbol))
      break
  }
  return symbols.filter((symbol): symbol is SymbolUnion => symbol != null)
}

/** Sodir's own symbology with the fill alpha capped, so outlines and legend colors stay recognizable. */
function withTranslucentFills(renderer: RendererUnion): RendererUnion {
  const clone = renderer.clone()
  for (const symbol of rendererSymbols(clone)) {
    if (symbol.type !== 'simple-fill' || !symbol.color || symbol.color.a <= MAX_FILL_ALPHA) continue
    const { r, g, b } = symbol.color
    symbol.color = new Color([r, g, b, MAX_FILL_ALPHA])
  }
  return clone
}

/** Hidden reference layers for the Norwegian continental shelf; toggle them through `visible`. */
export function createSodirReferenceLayers() {
  return SODIR_LAYERS.map(({ id, title, popupTitle }) => {
    const layer = new FeatureLayer({ url: `${SODIR_FACTMAPS}/${id}`, title, visible: false, outFields: ['*'] })
    // Popups list every field; the field list and renderer are only known once the layer has loaded.
    void layer
      .when(() => {
        if (layer.geometryType === 'polygon' && layer.renderer) layer.renderer = withTranslucentFills(layer.renderer)
        const template = layer.createPopupTemplate()
        if (!template) return
        if (popupTitle) template.title = popupTitle
        const fieldTypes = new Map(layer.fields.map((field) => [field.name, field.type]))
        for (const fieldInfo of template.fieldInfos ?? []) {
          const type = fieldTypes.get(fieldInfo.fieldName ?? '')
          if (type && INTEGER_FIELD_TYPES.has(type)) {
            fieldInfo.format = new FieldInfoFormat({ digitSeparator: false, places: 0 })
          }
        }
        // createPopupTemplate sorts the fields alphabetically by alias; restore the order Sodir publishes them in.
        const fieldOrder = new Map(layer.fields.map((field, index) => [field.name, index]))
        template.fieldInfos = [...(template.fieldInfos ?? [])].sort(
          (a, b) => (fieldOrder.get(a.fieldName ?? '') ?? 0) - (fieldOrder.get(b.fieldName ?? '') ?? 0)
        )
        layer.popupTemplate = template
      })
      .catch((error) => console.error(`Cannot configure Sodir layer "${title}".`, error))
    return layer
  })
}
