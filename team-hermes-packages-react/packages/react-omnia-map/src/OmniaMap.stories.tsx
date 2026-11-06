import Viewpoint from '@arcgis/core/Viewpoint'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState } from 'react'
import '@arcgis/map-components/components/arcgis-zoom'
import '@arcgis/map-components/components/arcgis-home'
import '@arcgis/map-components/components/arcgis-layer-list'
import '@arcgis/map-components/components/arcgis-expand'

import { getLayersExtent } from './helpers/layers-extent'
import { OmniaMap } from './OmniaMap'
import {
  DEFAULT_VISIBLE_REFERENCE_LAYERS,
  ReferenceLayersExample,
  type ReferenceLayersArgs,
} from './stories/ReferenceLayersExample'
import referenceLayersExampleSource from './stories/ReferenceLayersExample.tsx?raw'
import { createPlacesLayer, NORWEGIAN_CITIES, SODIR_REFERENCE_LAYER_TITLES, US_CITIES } from './stories/sample-data'
import sampleDataSource from './stories/sample-data.ts?raw'

// Esri's public "Accidental Deaths" web map (US states), the item used by the "Load a basic WebMap" sample:
// https://developers.arcgis.com/javascript/latest/sample-code/webmap-basic/
const PUBLIC_WEB_MAP_ID = 'e691172598f04ea8881cd2a4adaa45ba'

// The auto-generated snippet would show the local wrapper component and the serialized layer instances.
const snippet = (code: string) => ({ docs: { source: { type: 'code' as const, code } } })

const PUBLIC_BASEMAPS = [
  'topo-vector',
  'topo',
  'streets-vector',
  'streets',
  'streets-night-vector',
  'streets-navigation-vector',
  'streets-relief-vector',
  'gray-vector',
  'gray',
  'dark-gray-vector',
  'dark-gray',
  'satellite',
  'hybrid',
  'oceans',
  'osm',
  'terrain',
]

// Fill the story canvas (fullscreen layout, so no scrollbar). Docs sizes its iframe to the content, so a `vh` height
// there feeds back on itself and the map never settles; use a fixed height like the other map stories instead.
const STORY_MAP_HEIGHT = '95vh'
const DOCS_MAP_HEIGHT = 480

const meta = {
  title: 'Map/OmniaMap',
  component: OmniaMap,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, { viewMode, args }) => (
      <Story
        args={{ ...args, style: { height: viewMode === 'docs' ? DOCS_MAP_HEIGHT : STORY_MAP_HEIGHT, ...args.style } }}
      />
    ),
  ],
  args: {
    basemap: 'gray-vector',
    center: '10,62',
    zoom: 4,
  },
  argTypes: {
    basemap: {
      description: 'A well-known basemap id, or a `Basemap` instance. Ignored when `itemId` is set.',
      control: 'select',
      options: PUBLIC_BASEMAPS,
    },
    layers: {
      description: 'Consumer-owned ArcGIS `Layer` instances, reconciled by identity. Memoize the array.',
      control: false,
    },
    initialFitToLayers: {
      description:
        'Zoom to the extent of `layers` once, when the view is ready. Overrides `center`/`zoom`/`extent`. Pass a subset of `layers` to fit to those only.',
      control: 'boolean',
      table: { defaultValue: { summary: 'true' }, type: { summary: 'boolean | readonly Layer[]' } },
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
  const [initialFit, setInitialFit] = useState(args?.initialFitToLayers ?? true)
  const layers = useMemo(() => [createPlacesLayer(NORWEGIAN_CITIES, { title: 'Cities' })], [])
  // The fit happens only on mount, so we remount when the control changes, using the key prop.
  return (
    <>
      <div className="flex gap-2">
        <button onClick={() => setInitialFit(!initialFit)}>Toggle Initial Fit</button>
        <span>|</span>
        <span>Initial Fit: {initialFit ? 'On' : 'Off'}</span>
      </div>
      <OmniaMap key={String(initialFit)} {...args} initialFitToLayers={initialFit} layers={layers} />
    </>
  )
}

export const InitialFitToLayers: Story = {
  args: { center: '0,0', zoom: 2, initialFitToLayers: true },
  render: (args) => <InitialFitExample {...args} />,
  parameters: snippet(`const [initialFit, setInitialFit] = useState(args?.initialFitToLayers ?? true)
const layers = useMemo(() => [createPlacesLayer(NORWEGIAN_CITIES, { title: 'Cities' })], [])
// The fit happens once, so remount when the control changes.
return (
  <>
    <div className="flex gap-2">
      <button onClick={() => setInitialFit(!initialFit)}>Toggle Initial Fit</button>
      <span>| Initial Fit: {initialFit ? 'On' : 'Off'}</span>
    </div>
    <OmniaMap key={String(initialFit)} {...args} initialFitToLayers={initialFit} layers={layers} />
  </>
)`),
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

function OnMapControlsExample(args: Story['args']) {
  const cities = useMemo(() => createPlacesLayer(NORWEGIAN_CITIES.slice(0, 3), { title: 'Cities' }), [])
  const hubs = useMemo(
    () => createPlacesLayer(NORWEGIAN_CITIES.slice(3), { title: 'Northern hubs', color: '#d9534f' }),
    []
  )
  const layers = useMemo(() => [cities, hubs], [cities, hubs])

  const homeViewpoint = useMemo(() => {
    const extent = getLayersExtent(layers)
    return extent ? new Viewpoint({ targetGeometry: extent }) : undefined
  }, [layers])

  return (
    <OmniaMap {...args} itemId={PUBLIC_WEB_MAP_ID} layers={layers} hideWebMapLayers>
      <div className="flex flex-col gap-1" slot="top-left">
        <arcgis-zoom layout="vertical" />
        <arcgis-home viewpoint={homeViewpoint} />
      </div>
      <arcgis-expand slot="top-right" mode="floating" expand-tooltip="Layer list">
        <arcgis-layer-list />
      </arcgis-expand>
    </OmniaMap>
  )
}

export const OnMapControls: Story = {
  render: (args) => <OnMapControlsExample {...args} />,
  parameters: snippet(`import Viewpoint from '@arcgis/core/Viewpoint'
import { getLayersExtent, OmniaMap } from '@team-hermes/react-omnia-map'

// Each ArcGIS component must be imported once to register its custom element.
// This can be done in each relevant component, or ahead of time in a top-level module,
// if you know which components you will use.
// If a component is not imported, it will generally just show an empty placeholder or fail silently.
import '@arcgis/map-components/components/arcgis-zoom'
import '@arcgis/map-components/components/arcgis-home'
import '@arcgis/map-components/components/arcgis-expand'
import '@arcgis/map-components/components/arcgis-layer-list'

// The home button returns to the extent of the layers.
const homeViewpoint = useMemo(() => {
  const extent = getLayersExtent(layers)
  return extent ? new Viewpoint({ targetGeometry: extent }) : undefined
}, [layers])

<OmniaMap itemId="<your web map id>" layers={layers} hideWebMapLayers>
  <div slot="top-left">
    <arcgis-zoom layout="vertical" />
    <arcgis-home viewpoint={homeViewpoint} />
  </div>
  <arcgis-expand slot="top-right" mode="floating" expand-tooltip="Layer list">
    <arcgis-layer-list />
  </arcgis-expand>
</OmniaMap>`),
}

const REFERENCE_LAYERS_SOURCE = `// File: sample-data.ts
${sampleDataSource}
// File: ReferenceLayersExample.tsx (save beside sample-data.ts)
${referenceLayersExampleSource.replace("from '../index'", "from '@team-hermes/react-omnia-map'")}`

export const ReferenceLayers: StoryObj<ReferenceLayersArgs> = {
  parameters: {
    controls: { exclude: ['ref', 'layers', 'initialFitToLayers'] },
    docs: { source: { code: REFERENCE_LAYERS_SOURCE, language: 'tsx' } },
  },
  args: {
    basemap: 'gray-vector',
    visibleReferenceLayers: DEFAULT_VISIBLE_REFERENCE_LAYERS,
  },
  argTypes: {
    visibleReferenceLayers: {
      description: 'Story-only: toggles `visible` on the Sodir reference layers.',
      control: 'check',
      options: SODIR_REFERENCE_LAYER_TITLES,
    },
  },
  render: (args) => <ReferenceLayersExample {...args} />,
}
