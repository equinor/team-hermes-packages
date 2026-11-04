import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState } from 'react'

import { OmniaMap } from '@/components'
import { usePanLayersIntoView } from '@/hooks/usePanLayersIntoView'
import { createPlacesLayer, NORWEGIAN_CITIES } from '@/stories/sample-data'

const meta = {
  title: 'Map/usePanLayersIntoView',
  component: OmniaMap,
} satisfies Meta<typeof OmniaMap>

export default meta
type Story = StoryObj<typeof meta>

const NO_LAYERS: never[] = []

function PanExample() {
  const [mapElement, setMapElement] = useState<ArcgisMap | null>(null)
  const [hoveredName, setHoveredName] = useState<string | null>(null)

  const cityLayers = useMemo(
    () => new Map(NORWEGIAN_CITIES.map((city) => [city.name, createPlacesLayer([city], { title: city.name })])),
    []
  )
  const layers = useMemo(() => [...cityLayers.values()], [cityLayers])
  const hoveredLayers = useMemo(() => {
    const layer = hoveredName ? cityLayers.get(hoveredName) : undefined
    return layer ? [layer] : NO_LAYERS
  }, [cityLayers, hoveredName])

  usePanLayersIntoView(mapElement, hoveredLayers)

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {NORWEGIAN_CITIES.map(({ name }) => (
          <li key={name}>
            <button type="button" onMouseEnter={() => setHoveredName(name)} onMouseLeave={() => setHoveredName(null)}>
              {name}
            </button>
          </li>
        ))}
      </ul>
      <OmniaMap
        ref={setMapElement}
        basemap="topo-vector"
        center="10.75,59.91"
        zoom={8}
        initialFitToLayers={false}
        layers={layers}
        style={{ height: 480, flex: 1 }}
      />
    </div>
  )
}

export const PanOnHover: Story = {
  render: () => <PanExample />,
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: `const [mapElement, setMapElement] = useState<ArcgisMap | null>(null)
usePanLayersIntoView(mapElement, hoveredLayers)

<OmniaMap ref={setMapElement} basemap="topo-vector" initialFitToLayers={false} layers={layers} />`,
      },
    },
  },
}
