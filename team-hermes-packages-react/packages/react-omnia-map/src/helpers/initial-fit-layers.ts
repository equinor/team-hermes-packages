import type Layer from '@arcgis/core/layers/Layer'

/**
 * Resolves the `initialFitToLayers` prop: `true` fits to all of `layers`, an array fits to those layers only, and
 * `false` disables the fit (returns null).
 */
export function resolveInitialFitLayers(
  layers: readonly Layer[],
  initialFitToLayers: boolean | readonly Layer[]
): readonly Layer[] | null {
  if (initialFitToLayers === true) return layers
  if (initialFitToLayers === false) return null
  return initialFitToLayers
}
