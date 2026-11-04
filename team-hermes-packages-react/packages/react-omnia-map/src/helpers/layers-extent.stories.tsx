import Extent from '@arcgis/core/geometry/Extent'
import Graphic from '@arcgis/core/Graphic'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState } from 'react'

import { OmniaMap } from '@/components'
import { getLayersExtent } from '@/helpers/layers-extent'
import { createPlacesLayer, NORWEGIAN_CITIES } from '@/stories/sample-data'

const meta = {
  title: 'Map/getLayersExtent',
  component: OmniaMap,
} satisfies Meta<typeof OmniaMap>

export default meta
type Story = StoryObj<typeof meta>

function outline(extent: Extent | null) {
  return new GraphicsLayer({
    title: 'Extent',
    graphics: extent
      ? [
          new Graphic({
            geometry: extent,
            symbol: {
              type: 'simple-fill',
              color: [0, 0, 0, 0],
              outline: { color: '#d9534f', width: 2 },
            },
          }),
        ]
      : [],
  })
}

function ExtentExample() {
  const [mapElement, setMapElement] = useState<ArcgisMap | null>(null)
  const cities = useMemo(() => createPlacesLayer(NORWEGIAN_CITIES, { title: 'Cities' }), [])
  const layers = useMemo(() => [cities], [cities])
  const extent = useMemo(() => getLayersExtent(layers), [layers])
  const displayLayers = useMemo(() => [cities, outline(extent)], [cities, extent])

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <button type="button" disabled={!extent} onClick={() => extent && mapElement?.view.goTo(extent)}>
          Zoom to extent
        </button>
        {extent && (
          <code>
            x: {extent.xmin.toFixed(2)} … {extent.xmax.toFixed(2)}, y: {extent.ymin.toFixed(2)} …{' '}
            {extent.ymax.toFixed(2)}
          </code>
        )}
      </div>
      <OmniaMap
        ref={setMapElement}
        basemap="topo-vector"
        center="0,0"
        zoom={2}
        initialFitToLayers={false}
        layers={displayLayers}
        style={{ height: 480 }}
      />
    </>
  )
}

export const PaddedExtent: Story = {
  render: () => <ExtentExample />,
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: `const extent = getLayersExtent(layers) // or getLayersExtent(layers, 0.5) for 50% padding
if (extent) await mapElement.view.goTo(extent)`,
      },
    },
  },
}
