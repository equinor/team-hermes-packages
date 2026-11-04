import { isAbortError } from '@arcgis/core/core/promiseUtils'
import { watch } from '@arcgis/core/core/reactiveUtils'
import Graphic from '@arcgis/core/Graphic'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { type CSSProperties, useEffect, useState } from 'react'

export type OmniaMiniMapPlacement =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'

export interface OmniaMiniMapProps {
  parent: ArcgisMap | null
  basemap: NonNullable<ArcgisMap['basemap']>
  slot?: OmniaMiniMapPlacement
  width?: number
  height?: number
  border?: string
  background?: CSSProperties['background']
  style?: CSSProperties
}

function disableInteractivity(view: ArcgisMap) {
  /**
   * Adjusted from https://developers.arcgis.com/javascript/latest/sample-code/view-disable-navigation/
   */

  // stops propagation of default behavior when an event fires
  function stopEvtPropagation(
    event: ArcgisMap['arcgisViewMouseWheel' | 'arcgisViewDoubleClick' | 'arcgisViewDrag' | 'arcgisViewDoubleTapDrag']
  ) {
    event.detail.stopPropagation()
  }
  // disable mouse wheel scroll zooming on the view
  view.addEventListener('arcgisViewMouseWheel', stopEvtPropagation)

  // disable zooming via double-click on the view
  view.addEventListener('arcgisViewDoubleClick', stopEvtPropagation)

  // disable zooming out via double-click + Control on the view
  // @ts-expect-error - ArcgisMap is missing the type overload for modifier keys
  view.addEventListener('arcgisViewDoubleClick', ['Control'], stopEvtPropagation)

  // disables pinch-zoom and panning on the view
  view.addEventListener('arcgisViewDrag', stopEvtPropagation)

  // disables double tap drag to zoom on the view
  view.addEventListener('arcgisViewDoubleTapDrag', stopEvtPropagation)

  // disable the view's zoom box to prevent the Shift + drag
  // and Shift + Control + drag zoom gestures.
  // @ts-expect-error - ArcgisMap is missing the type overload for modifier keys
  view.addEventListener('arcgisViewDrag', ['Shift'], stopEvtPropagation)
  // @ts-expect-error - ArcgisMap is missing the type overload for modifier keys
  view.addEventListener('arcgisViewDrag', ['Shift', 'Control'], stopEvtPropagation)

  // prevents zooming with the + and - keys
  view.addEventListener('arcgisViewKeyDown', (event) => {
    const prohibitedKeys = ['+', '-', 'Shift', '_', '=', 'ArrowUp', 'ArrowDown', 'ArrowRight', 'ArrowLeft']
    const keyPressed = event.detail.key
    if (prohibitedKeys.indexOf(keyPressed) !== -1) {
      event.detail.stopPropagation()
    }
  })
}

// Adapted from Esri's overview-map sample, using a 2D main map instead of a scene:
// https://developers.arcgis.com/javascript/latest/sample-code/overview-map/
export function OmniaMiniMap({
  parent,
  basemap,
  slot = 'top-right',
  style = {},
  width = 220,
  height = 160,
  background = 'white',
  border = '1px solid black',
}: OmniaMiniMapProps) {
  const [overviewMap, setOverviewMap] = useState<ArcgisMap | null>(null)

  const _style: CSSProperties = { width, height, border, background, ...style }

  useEffect(() => {
    if (!parent || !overviewMap) return
    let canceled = false
    let cleanup: (() => void) | undefined

    const reportError = (error: unknown) => {
      if (!canceled && !isAbortError(error)) console.error('Could not update minimap:', error)
    }

    void Promise.all([parent.viewOnReady(), overviewMap.viewOnReady()])
      .then(() => {
        if (canceled) return

        // Disable interactivity
        overviewMap.constraints.rotationEnabled = false
        overviewMap.constraints.snapToZoom = false
        if (overviewMap.popup) overviewMap.popup.actions = []

        disableInteractivity(overviewMap)

        const footprint = new Graphic({
          symbol: {
            type: 'simple-fill',
            color: [0, 0, 0, 0.2],
            outline: { color: 'black', width: 1 },
          },
        })
        const graphics = overviewMap.graphics
        graphics.add(footprint)

        const handle = watch(
          () => [parent.extent, parent.view.visibleArea] as const,
          ([extent, visibleArea]) => {
            // visibleArea also follows rotation, unlike the axis-aligned view extent.
            footprint.geometry = visibleArea ?? null
            if (extent) {
              // Follow the main map only, with some context around its footprint.
              void overviewMap
                .goTo(extent.clone().expand(1 + parent.zoom * 1.5), { animate: false })
                .catch(reportError)
            }
          },
          { initial: true }
        )
        cleanup = () => {
          handle.remove()
          graphics.remove(footprint)
        }
      })
      .catch(reportError)

    return () => {
      canceled = true
      cleanup?.()
      // Each <arcgis-map> destroys its own view when unmounted.
    }
  }, [parent, overviewMap])

  return <arcgis-map ref={setOverviewMap} slot={slot} basemap={basemap} hideAttribution style={_style} />
}
