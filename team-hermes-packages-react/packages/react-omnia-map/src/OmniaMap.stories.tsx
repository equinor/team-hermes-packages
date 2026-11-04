import type { ArcgisMap } from '@arcgis/map-components/components/arcgis-map'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState } from 'react'
import { useLayerHighlight } from './hooks/useLayerHighlight'
import { OmniaMap } from './OmniaMap'
import { createPlacesLayer, NORWEGIAN_CITIES, US_CITIES } from './stories/sample-data'

// Esri's public "Accidental Deaths" web map (US states), the item used by the "Load a basic WebMap" sample:
// https://developers.arcgis.com/javascript/latest/sample-code/webmap-basic/
const PUBLIC_WEB_MAP_ID = 'e691172598f04ea8881cd2a4adaa45ba'

// The auto-generated snippet would show the local wrapper component and the serialized layer instances.
const snippet = (code: string) => ({ docs: { source: { type: 'code' as const, code } } })

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

export const Basic: Story = {
  render: (args) => <BasicExample {...args} />,
  parameters: snippet(`const layers = useMemo(() => [new GraphicsLayer({ title: 'Cities', graphics })], [graphics])

<OmniaMap basemap="topo-vector" center="10,62" zoom={4} layers={layers} style={{ height: 480 }} />`),
}

function BasicExample(args: Story['args']) {
  const layers = useMemo(() => [createPlacesLayer(NORWEGIAN_CITIES, { title: 'Cities' })], [])
  return <OmniaMap {...args} layers={layers} />
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
  parameters: snippet(`<OmniaMap
  basemap="topo-vector"
  layers={layers}
  onLayerClick={(layer, hit) => console.log(layer?.title, hit?.graphic.attributes)}
/>`),
}

function InitialFitExample(args: Story['args']) {
  const layers = useMemo(() => [createPlacesLayer(NORWEGIAN_CITIES, { title: 'Cities' })], [])
  // The fit happens once, so remount when the control changes.
  return <OmniaMap key={String(args?.initialFitToLayers)} {...args} layers={layers} />
}

export const InitialFitToLayers: Story = {
  args: { center: '0,0', zoom: 2, initialFitToLayers: true },
  render: (args) => <InitialFitExample {...args} />,
  parameters: snippet(`// Starts at 0,0 and zooms to the layers once, when the view is ready.
// Set initialFitToLayers={false} to keep center and zoom.
<OmniaMap basemap="topo-vector" center="0,0" zoom={2} layers={layers} />`),
}

function HideWebMapLayersExample(args: Story['args']) {
  const layers = useMemo(() => [createPlacesLayer(US_CITIES, { title: 'Cities' })], [])
  // Hiding is applied when each layer view is created, so remount when the control changes.
  return <OmniaMap key={String(args?.hideWebMapLayers)} {...args} layers={layers} />
}

export const HideWebMapLayers: Story = {
  args: {
    basemap: undefined,
    itemId: PUBLIC_WEB_MAP_ID,
    hideWebMapLayers: true,
  },
  render: (args) => <HideWebMapLayersExample {...args} />,
  parameters: snippet(
    `<OmniaMap itemId="<your web map id>" hideWebMapLayers layers={layers} style={{ height: 480 }} />`
  ),
}

function SwitchMapExample(args: Story['args']) {
  const [mapElement, setMapElement] = useState<ArcgisMap | null>(null)
  const [itemId, setItemId] = useState<string | undefined>(PUBLIC_WEB_MAP_ID)
  const cities = useMemo(() => createPlacesLayer(NORWEGIAN_CITIES.slice(0, 3), { title: 'Cities' }), [])
  const hubs = useMemo(
    () => createPlacesLayer(NORWEGIAN_CITIES.slice(3), { title: 'Northern hubs', color: '#d9534f' }),
    []
  )
  const layers = useMemo(() => [cities, hubs], [cities, hubs])
  const highlighted = useMemo(() => [hubs], [hubs])

  useLayerHighlight(mapElement, highlighted)

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button type="button" disabled={itemId === PUBLIC_WEB_MAP_ID} onClick={() => setItemId(PUBLIC_WEB_MAP_ID)}>
          Web map
        </button>
        <button type="button" disabled={itemId === undefined} onClick={() => setItemId(undefined)}>
          Topo basemap only
        </button>
      </div>
      <OmniaMap
        {...args}
        ref={setMapElement}
        itemId={itemId}
        basemap={itemId ? undefined : 'topo-vector'}
        hideWebMapLayers
        layers={layers}
      />
    </>
  )
}

export const SwitchMap: Story = {
  render: (args) => <SwitchMapExample {...args} />,
  parameters: snippet(`const [mapElement, setMapElement] = useState<ArcgisMap | null>(null)
useLayerHighlight(mapElement, highlightedLayers)

// Changing itemId remounts the element; the layers and the highlight follow it.
<OmniaMap
  ref={setMapElement}
  itemId={itemId}
  basemap={itemId ? undefined : 'topo-vector'}
  hideWebMapLayers
  layers={layers}
/>`),
}
