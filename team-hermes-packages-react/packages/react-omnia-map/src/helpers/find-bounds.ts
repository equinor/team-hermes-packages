type Bounds = {
  minLatitude: number
  maxLatitude: number
  minLongitude: number
  maxLongitude: number
}

// A minimum difference between min and max, to ensure the bounds are not too small.
// This is done to ensure that the map does not zoom in too closely on a very small area,
// and to fix a bug where ArcGIS could not zoom in for a single point (where min and max are equal).
export const MINIMUM_DIFFERENCE = 0.5

export function findBounds(coordinates: [latitude: number, longitude: number][]): Bounds {
  if (coordinates.length === 0) {
    // return "the entire world"
    return {
      minLatitude: -90,
      maxLatitude: 90,
      minLongitude: -180,
      maxLongitude: 180,
    }
  }
  let minLatitude = 90
  let maxLatitude = -90
  let minLongitude = 180
  let maxLongitude = -180

  for (const [latitude, longitude] of coordinates) {
    if (latitude < minLatitude) minLatitude = latitude
    if (latitude > maxLatitude) maxLatitude = latitude
    if (longitude < minLongitude) minLongitude = longitude
    if (longitude > maxLongitude) maxLongitude = longitude
  }

  if (maxLatitude - minLatitude < MINIMUM_DIFFERENCE) {
    const midLatitude = (maxLatitude + minLatitude) / 2
    minLatitude = midLatitude - MINIMUM_DIFFERENCE / 2
    maxLatitude = midLatitude + MINIMUM_DIFFERENCE / 2
  }
  if (maxLongitude - minLongitude < MINIMUM_DIFFERENCE) {
    const midLongitude = (maxLongitude + minLongitude) / 2
    minLongitude = midLongitude - MINIMUM_DIFFERENCE / 2
    maxLongitude = midLongitude + MINIMUM_DIFFERENCE / 2
  }

  return {
    minLatitude,
    maxLatitude,
    minLongitude,
    maxLongitude,
  }
}
