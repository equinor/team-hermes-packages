import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { OmniaMap, OmniaMiniMap } from '@/components'
import { snippet } from '@/stories/helpers.ts'

const meta = {
  title: 'Map/OmniaMiniMap',
  component: OmniaMiniMap,
  args: {
    parent: null,
    basemap: 'topo-vector',
    slot: 'top-right',
    width: 220,
    height: 160,
    background: 'white',
    border: '1px solid black',
  },
  argTypes: {
    slot: {
      options: [
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
        'top-start',
        'top-end',
        'bottom-start',
        'bottom-end',
      ],
      control: { type: 'select' },
    },
    parent: {
      control: false,
      description: 'The parent map which the mini map should follow',
    },
  },
} satisfies Meta<typeof OmniaMiniMap>

export default meta
type Story = StoryObj<typeof meta>

export const MiniMap: Story = {
  render: (args) => {
    const [mainMap, setMainMap] = useState<ArcgisMap | null>(null)

    return (
      <OmniaMap ref={setMainMap} basemap="topo-vector" center={'10,62'} zoom={4} style={{ height: 480 }}>
        <OmniaMiniMap {...args} parent={mainMap} />
      </OmniaMap>
    )
  },
  parameters: {
    ...snippet(`
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { OmniaMap, OmniaMiniMap } from '@team-hermes/react-omnia-map'
import { useState } from 'react'

const [map, setMap] = useState<ArcgisMap | null>(null)

return (
  <OmniaMap ref={setMap} basemap="topo-vector" center="10,62" zoom={4} style={{ height: 480 }}>
    <OmniaMiniMap parent={map} slot="top-right" basemap="topo-vector" />
  </OmniaMap>
)
`),
  },
}
