import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState } from 'react'
import { OmniaMap } from './OmniaMap'
import { createPlacesLayer, NORWEGIAN_CITIES, US_CITIES } from './stories/sample-data'

const meta = {
  title: 'Map/OmniaMap',
  component: OmniaMap,
  args: {
    basemap: 'topo-vector',
    center: '10,62',
    zoom: 4,
    style: { height: 480 },
  },
  argTypes: {
    layers: {
      description: 'Consumer-owned ArcGIS `Layer` instances, reconciled by identity. Memoize the array.',
      control: false,
    },
    initialFitToLayers: {
      description: 'Zoom to the extent of `layers` once, when the view is ready. Overrides `center`/`zoom`/`extent`.',
      control: 'boolean',
      table: { defaultValue: { summary: 'true' } },
    },
    hideWebMapLayers: {
      description:
        "Hide the web map's own operational layers, leaving only `layers`. Applied when each layer view is created.",
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    onMapClick: {
      description: 'Called with the map point of every click on the view.',
      control: false,
    },
    onLayerClick: {
      description: 'Called on every click with the topmost layer from `layers` under the pointer, or null.',
      control: false,
    },
    ref: {
      description: 'Ref to the underlying `<arcgis-map>` element.',
      control: false,
    },
  },
} satisfies Meta<typeof OmniaMap>

export default meta
type Story = StoryObj<typeof meta>

function BasicExample(args: Story['args']) {
  const layers = useMemo(() => [createPlacesLayer(NORWEGIAN_CITIES, { title: 'Cities' })], [])
  return <OmniaMap {...args} layers={layers} />
}

export const Basic: Story = {
  render: (args) => <BasicExample {...args} />,
}

function LayerClickExample(args: Story['args']) {
  const layers = useMemo(() => [createPlacesLayer(NORWEGIAN_CITIES, { title: 'Cities' })], [])
  const [clicked, setClicked] = useState<string | null>(null)

  return (
    <>
      <OmniaMap
        {...args}
        layers={layers}
        onLayerClick={(layer, hit) => setClicked(layer ? `${layer.title}: ${hit?.graphic.attributes.name}` : null)}
      />
      <p>Clicked: {clicked ?? 'nothing (click a city)'}</p>
    </>
  )
}

export const LayerClick: Story = {
  render: (args) => <LayerClickExample {...args} />,
}

function InitialFitExample(args: Story['args']) {
  const layers = useMemo(() => [createPlacesLayer(NORWEGIAN_CITIES, { title: 'Cities' })], [])
  // The fit happens once, so remount when the control changes.
  return <OmniaMap key={String(args?.initialFitToLayers)} {...args} layers={layers} />
}

export const InitialFitToLayers: Story = {
  args: { center: '0,0', zoom: 2, initialFitToLayers: true },
  render: (args) => <InitialFitExample {...args} />,
}

function HideWebMapLayersExample(args: Story['args']) {
  const layers = useMemo(() => [createPlacesLayer(US_CITIES, { title: 'Cities' })], [])
  // Hiding is applied when each layer view is created, so remount when the control changes.
  return <OmniaMap key={String(args?.hideWebMapLayers)} {...args} layers={layers} />
}

export const HideWebMapLayers: Story = {
  args: {
    basemap: undefined,
    itemId: 'f2e9b762544945f390ca4ac3671cfa72',
    hideWebMapLayers: true,
  },
  render: (args) => <HideWebMapLayersExample {...args} />,
}
