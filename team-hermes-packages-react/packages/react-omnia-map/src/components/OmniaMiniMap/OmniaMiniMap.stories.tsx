import type { Meta, StoryObj } from '@storybook/react-vite'
import { OmniaMiniMap } from './OmniaMiniMap'
import { useMemo, useState } from 'react'
import { createPlacesLayer, NORWEGIAN_CITIES } from '../../stories/sample-data'
import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import { OmniaMap } from '../OmniaMap/OmniaMap'
import { PUBLIC_WEB_MAP_ID, snippet } from '../../stories/constants'

const meta = {
  title: 'Map/OmniaMiniMap',
  component: OmniaMiniMap,
  args: { mainMap: null, zoomOffset: 5, style: { width: 200, height: 200 } },
  argTypes: {
    mainMap: { description: "The main map element (from `OmniaMap`'s `ref`) to follow and outline.", control: false },
    zoomOffset: {
      description: 'Zoom levels further out than the main map.',
      control: { type: 'range', min: 0, max: 10, step: 1 },
      table: { defaultValue: { summary: '5' } },
    },
    extentSymbol: { description: 'Autocast symbol for the extent outline.', control: false },
  },
} satisfies Meta<typeof OmniaMiniMap>

export default meta
type Story = StoryObj<typeof meta>

function FollowExample(args: Story['args']) {
  const layers = useMemo(() => [createPlacesLayer(NORWEGIAN_CITIES, { title: 'Cities' })], [])
  const [mainMap, setMainMap] = useState<ArcgisMap | null>(null)
  return (
    <div className="relative">
      <OmniaMap ref={setMainMap} itemId={PUBLIC_WEB_MAP_ID} layers={layers} hideWebMapLayers style={{ height: 480 }}>
        <arcgis-zoom slot="top-left" />
      </OmniaMap>
      <OmniaMiniMap
        {...args}
        mainMap={mainMap}
        itemId={PUBLIC_WEB_MAP_ID}
        className="absolute right-4 bottom-4 border-2 border-white shadow-md"
      />
    </div>
  )
}
export const Follow: Story = {
  render: (args) => <FollowExample {...args} />,
  parameters: snippet(`…`),
}

// TODO: `WideMiniMap` story: args style { width: 320, height: 160 } — non-square still clamps at the world.
