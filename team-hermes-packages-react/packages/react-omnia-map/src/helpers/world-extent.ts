import type MapView from '@arcgis/core/views/MapView'

// Width of the world in Web Mercator metres. Latitude is clipped at ±85.05°, so the world is a square.
export const WORLD_WIDTH_METERS = 2 * 20037508.342789244

// ArcGIS scale = metres per pixel × (96 dpi ÷ 0.0254 m per inch).
const PIXELS_PER_METER = 96 / 0.0254

/**
 * The smallest scale (most zoomed out) at which the whole world still fits inside `view`.
 * NOTE: We only consider the height of the view, because vertically we want to avoid "black bars".
 * Horizontally, however, the world map wraps around, so we don't need to worry about "black bars".
 */
export function worldFitScale(view: Pick<MapView, 'width' | 'height'>): number {
  const height = Math.max(1, view.height)
  return (WORLD_WIDTH_METERS / height) * PIXELS_PER_METER
}

/** Clamps a Web Mercator centre y so that view `heightPx` tall at `scale` never shows areas outside the world. */
export function clampCenterYToWorld(centreY: number, heightPx: number, scale: number): number {
  const halfHeightMeters = (heightPx * scale) / PIXELS_PER_METER / 2
  const maxCenterY = WORLD_WIDTH_METERS / 2 - halfHeightMeters
  // If the view is taller than the world at this scale, the center should be clamped to 0.
  if (maxCenterY <= 0) return 0
  return Math.min(Math.max(centreY, -maxCenterY), maxCenterY)
}
