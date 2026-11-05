import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { useEffect } from 'react'
import { clampCenterYToWorld, worldFitScale } from '../helpers/world-extent'
import { watch } from '@arcgis/core/core/reactiveUtils'
import Point from '@arcgis/core/geometry/Point'

const noop = () => {}

/**
 * Keeps `follower`'s view centred on `leader`'s view, at `leader.scale × 2^zoomOffset` but never zoomed out beyond
 * the whole world. Moves are instant. Re-evaluates when the leader moves and when the follower is resized.
 * Note that this should not be used on maps with `zoom`, `center` or `extent` controlled externally.
 */
export function useFollowView(follower: ArcgisMap | null, leader: ArcgisMap | null, zoomOffset: number) {
  useEffect(() => {
    if (!follower || !leader) return

    let canceled = false
    let handle: { remove: () => void } | null = null

    void Promise.all([follower.viewOnReady(), leader.viewOnReady()]).then(() => {
      if (canceled) return

      // We use an arrow function and not a regular function because those are hoisted.
      // A side effect would be that the non-null assertions at the start wouldn't be accepted by TS inside the function.
      const syncMaps = () => {
        const { center, scale } = leader.view
        if (!center) return
        const targetScale = Math.min(scale * 2 ** zoomOffset, worldFitScale(follower.view))
        const centerY = clampCenterYToWorld(center.y, follower.view.height, targetScale)
        follower.view.center = new Point({ x: center.x, y: centerY, spatialReference: center.spatialReference })
        follower.view.scale = targetScale
      }
      handle = watch(
        () => [leader.view.center, leader.view.scale, follower.view.width, follower.view.height] as const,
        syncMaps,
        { initial: true }
      )
    }, noop)

    return () => {
      canceled = true
      handle?.remove()
    }
  }, [follower, leader, zoomOffset])
}
