# @team-hermes/react-omnia-map

A React wrapper around the ArcGIS `<arcgis-map>` web component for Team Hermes projects. It accepts every `<arcgis-map>` prop and child, and adds reactive `layers`, click helpers and fit-to-layers behavior.

Documentation and live examples are in the Storybook of this repository (see the `Map` section).

## Installation

```sh
npm install @team-hermes/react-omnia-map @arcgis/core @arcgis/map-components
```

Peer dependencies: `react` and `react-dom` (^19), `@arcgis/core` and `@arcgis/map-components` (^5.1).

- **React 19 is required.** `OmniaMap` passes props and event handlers (such as `onarcgisViewClick`) straight to the `<arcgis-map>` custom element, which only React 19 supports. React 18 and older are not supported.
- **The ArcGIS packages are peers** so your app and this package share a single copy. Two copies would break `instanceof` checks on layers, register the custom element twice, and double the bundle size.

### Types

The package's type declarations already reference `@arcgis/map-components/types/react`, so the props of `OmniaMap` are typed without any setup. If you also use `<arcgis-map>` or other ArcGIS components directly in your own JSX (for example widgets slotted into the map), reference the ArcGIS React types once in your app, for example in `src/arcgis.d.ts`:

```ts
/// <reference types="@arcgis/map-components/types/react" />
```

## Usage

```tsx
import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import { OmniaMap } from '@team-hermes/react-omnia-map'
import { useMemo } from 'react'

export function Example() {
  const layers = useMemo(
    () => [
      new GraphicsLayer({
        graphics: [
          new Graphic({
            geometry: new Point({ longitude: 10.75, latitude: 59.91 }),
            symbol: { type: 'simple-marker', color: '#007079', size: 12 },
          }),
        ],
      }),
    ],
    []
  )

  return <OmniaMap basemap="topo-vector" layers={layers} style={{ height: 480 }} />
}
```

- `layers` are ArcGIS `Layer` instances you own. They are reconciled by identity, so memoize the array.
- `initialFitToLayers` (default `true`) zooms to the layers once, when the view is ready. Pass a subset of `layers` to fit to those only, e.g. to leave wide reference layers out.
- `hideWebMapLayers` hides the web map's own operational layers, leaving only `layers`.
- `onMapClick` and `onLayerClick` report clicks on the map and on your layers.
- Style the map with `className` / `style`. There is no CSS or UI-kit dependency.
- Widgets are not registered for you. Import the ones you slot into the map, for example `import '@arcgis/map-components/components/arcgis-zoom'`.

### Hooks and helpers

- `useLayerHighlight(mapElement, layers)` highlights the graphics of `GraphicsLayer`s.
- `usePanLayersIntoView(mapElement, layers, { delayMs })` pans the view so the layers' graphics become visible.
- `getLayersExtent(layers, padding = 0.2)` returns the extent of the layers, padded by 20% by default, or `null`.

Get `mapElement` through the `ref` of `OmniaMap`.

## Authentication

`OmniaMap` is auth-unaware and always renders. For private web maps, wrap your app in `OmniaMapsAuthContextProvider` and gate rendering with `useOmniaMapsAuth()` in your own wrapper:

```tsx
<OmniaMapsAuthContextProvider appId="<your app id>">
  <App />
</OmniaMapsAuthContextProvider>
```

Sign-in redirects the page by default. Pass `popup` to use a popup window instead (needed inside iframes). This requires an `oauth-callback.html` page served at the root of your own app's origin, registered as a redirect URI on your OAuth2 application. Don't register a URL on a host shared with other projects.

## Write an app-level wrapper

The intended consumption model is a small wrapper in your app that gates on authentication, builds layers from your domain data, and memoizes them:

```tsx
export function WellsMap({ wells }: { wells: Well[] }) {
  const { authenticationStatus, handleSignIn } = useOmniaMapsAuth()
  const layers = useMemo(() => [new GraphicsLayer({ graphics: wells.map(toGraphic) })], [wells])

  if (authenticationStatus === 'checking' || authenticationStatus === 'signing-in') return <Spinner />
  if (authenticationStatus === 'signed-out') return <button onClick={handleSignIn}>Sign in</button>

  return <OmniaMap itemId="<your web map id>" layers={layers} style={{ height: '100%' }} />
}
```
