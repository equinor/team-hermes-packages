import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState } from 'react'

import { OmniaMap } from '../OmniaMap'
import { createPlacesLayer, NORWEGIAN_CITIES } from '../stories/sample-data'
import { useLayerHighlight } from './useLayerHighlight'

const meta = {
  title: 'Map/useLayerHighlight',
  component: OmniaMap,
} satisfies Meta<typeof OmniaMap>

export default meta
type Story = StoryObj<typeof meta>

const NO_LAYERS: never[] = []

function HighlightExample() {
  const [mapElement, setMapElement] = useState<ArcgisMap | null>(null)
  const [highlightHubs, setHighlightHubs] = useState(true)

  const cities = useMemo(() => createPlacesLayer(NORWEGIAN_CITIES.slice(0, 3), { title: 'Cities' }), [])
  const hubs = useMemo(
    () =>
      createPlacesLayer(NORWEGIAN_CITIES.slice(3), {
        title: 'Northern hubs',
        color: '#d9534f',
      }),
    []
  )
  const layers = useMemo(() => [cities, hubs], [cities, hubs])
  const highlighted = useMemo(() => (highlightHubs ? [hubs] : NO_LAYERS), [highlightHubs, hubs])

  useLayerHighlight(mapElement, highlighted)

  return (
    <>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <input type="checkbox" checked={highlightHubs} onChange={(event) => setHighlightHubs(event.target.checked)} />{' '}
        Highlight the northern hubs
      </label>
      <OmniaMap ref={setMapElement} basemap="topo-vector" layers={layers} style={{ height: 480 }} />
    </>
  )
}

export const Highlight: Story = {
  render: () => <HighlightExample />,
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: `const [mapElement, setMapElement] = useState<ArcgisMap | null>(null)
useLayerHighlight(mapElement, highlightedLayers)

<OmniaMap ref={setMapElement} basemap="topo-vector" layers={layers} />`,
      },
    },
  },
}
