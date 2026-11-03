import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'

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
