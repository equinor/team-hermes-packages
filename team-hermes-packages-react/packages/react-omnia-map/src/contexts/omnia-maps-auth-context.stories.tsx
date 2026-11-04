import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo } from 'react'

import { OmniaMap } from '@/components'
import { OmniaMapsAuthContextProvider, useOmniaMapsAuth } from '@/contexts/omnia-maps-auth-context'
import { createPlacesLayer, NORWEGIAN_CITIES } from '@/stories/sample-data'

const PLACEHOLDER_APP_ID = 'client_id_replace_me'

const meta = {
  title: 'Map/OmniaMapsAuth',
  component: OmniaMapsAuthContextProvider,
  args: {
    appId: PLACEHOLDER_APP_ID,
    portalUrl: 'https://www.arcgis.com',
    // Storybook renders stories in an iframe, where the sign-in page cannot be framed.
    popup: true,
  },
  argTypes: {
    appId: {
      description: 'App ID (client_id) of your OAuth2 application. Edit it here to try a real sign-in.',
    },
    portalUrl: {
      description: 'Portal URL of your ArcGIS organization. Read once on mount.',
    },
    popup: {
      description: 'Sign in through a popup window instead of a page redirect. Read once on mount.',
      table: { defaultValue: { summary: 'false' } },
    },
    children: { control: false },
  },
} satisfies Meta<typeof OmniaMapsAuthContextProvider>

export default meta
type Story = StoryObj<typeof meta>

function StatusPanel({ appId }: { appId: string }) {
  const { authenticationStatus, handleSignIn } = useOmniaMapsAuth()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span>
          Status: <code>{authenticationStatus}</code>
        </span>
        <button type="button" onClick={handleSignIn} disabled={authenticationStatus !== 'signed-out'}>
          Sign in
        </button>
      </div>
      {appId === PLACEHOLDER_APP_ID && (
        <small>
          Replace the placeholder appId in the controls; signing in fails with “Invalid client_id” until then.
        </small>
      )}
    </div>
  )
}

export const Status: Story = {
  // The provider reads its props once on mount, so remount when the controls change.
  render: (args) => (
    <OmniaMapsAuthContextProvider key={`${args.appId}|${args.portalUrl}|${args.popup}`} {...args}>
      <StatusPanel appId={args.appId} />
    </OmniaMapsAuthContextProvider>
  ),
}

function AuthGatedMap() {
  const { authenticationStatus, handleSignIn } = useOmniaMapsAuth()
  const layers = useMemo(() => [createPlacesLayer(NORWEGIAN_CITIES, { title: 'Cities' })], [])

  if (authenticationStatus === 'checking' || authenticationStatus === 'signing-in') return <p>Loading…</p>
  if (authenticationStatus === 'signed-out') {
    return (
      <button type="button" onClick={handleSignIn}>
        Sign in to view the map
      </button>
    )
  }
  return <OmniaMap basemap="topo-vector" layers={layers} style={{ height: 400 }} />
}

export const AuthGate: Story = {
  render: (args) => (
    <OmniaMapsAuthContextProvider key={`${args.appId}|${args.portalUrl}|${args.popup}`} {...args}>
      <AuthGatedMap />
    </OmniaMapsAuthContextProvider>
  ),
}
