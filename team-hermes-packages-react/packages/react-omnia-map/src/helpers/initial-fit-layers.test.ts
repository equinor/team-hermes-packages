import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import { describe, expect, it } from 'vite-plus/test'

import { resolveInitialFitLayers } from './initial-fit-layers'

describe('resolveInitialFitLayers', () => {
  const a = new GraphicsLayer()
  const b = new GraphicsLayer()
  const layers = [a, b]

  it('fits to every layer when true', () => {
    expect(resolveInitialFitLayers(layers, true)).toBe(layers)
  })

  it('disables the fit when false', () => {
    expect(resolveInitialFitLayers(layers, false)).toBeNull()
  })

  it('fits to the given subset only', () => {
    const subset = [a]
    expect(resolveInitialFitLayers(layers, subset)).toBe(subset)
  })

  it('disables the fit for an empty subset rather than falling back to all layers', () => {
    const none: GraphicsLayer[] = []
    expect(resolveInitialFitLayers(layers, none)).toBe(none)
  })
})
