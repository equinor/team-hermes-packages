import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { useEffect, useMemo, useState } from 'react'
import { OmniaMap, type OmniaMapProps, useNearestFirstPopup } from '../index'
import { createPlacesLayer, createSodirReferenceLayers, NORWEGIAN_CITIES } from './sample-data'

export const DEFAULT_VISIBLE_REFERENCE_LAYERS = [
  'Borders and areas / Area status',
  'Borders and areas / Sub areas',
  'Borders and areas / Quadrants (SBM)',
  'Borders and areas / Blocks',
  'Hydrocarbon / Discovery, active - by HC type',
  'Licencing / Production licence, all - current by operator',
  'Facilities and pipelines / Pipelines',
  'Facilities and pipelines / Facilities, in place',
  'Wellbores / Wellbores, all',
  'Wellbores / CO2-storage wellbores',
]

export type ReferenceLayersArgs = Omit<OmniaMapProps, 'ref' | 'layers' | 'initialFitToLayers'> & {
  visibleReferenceLayers?: readonly string[]
}

/**
 * Use <ReferenceLayersExample /> for the default map. An app can replace the city graphics with its own data
 * and pass selected layer titles through visibleReferenceLayers, for example from a checkbox list.
 */
export function ReferenceLayersExample({
  visibleReferenceLayers = DEFAULT_VISIBLE_REFERENCE_LAYERS,
  style,
  ...mapProps
}: ReferenceLayersArgs) {
  const [mapElement, setMapElement] = useState<ArcgisMap | null>(null)
  const cities = useMemo(() => createPlacesLayer(NORWEGIAN_CITIES, { title: 'Cities' }), [])
  const referenceLayers = useMemo(() => createSodirReferenceLayers(), [])
  // Add reference layers first so application graphics draw above them.
  const layers = useMemo(() => [...referenceLayers, cities], [referenceLayers, cities])
  const fitLayers = useMemo(() => [cities], [cities])

  useEffect(() => {
    for (const layer of referenceLayers) layer.visible = visibleReferenceLayers.includes(layer.title ?? '')
  }, [referenceLayers, visibleReferenceLayers])

  useNearestFirstPopup(mapElement)

  return (
    <OmniaMap
      basemap="gray-vector"
      center="10,62"
      zoom={4}
      {...mapProps}
      ref={setMapElement}
      layers={layers}
      initialFitToLayers={fitLayers}
      style={{ height: 480, ...style }}
    />
  )
}
