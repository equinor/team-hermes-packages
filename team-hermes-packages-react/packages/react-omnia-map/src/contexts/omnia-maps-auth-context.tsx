import identityManager from '@arcgis/core/identity/IdentityManager'
import OAuthInfo from '@arcgis/core/identity/OAuthInfo'
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react'

export type OmniaMapsAuthenticationStatus = 'checking' | 'signed-in' | 'signed-out' | 'signing-in'

type OmniaMapsAuthContextProviderProps = PropsWithChildren<{
  /**
   * App ID for your OAuth2 application (created in the ArcGIS Developer Dashboard).
   * Read once when the provider mounts; changing it afterwards has no effect.
   */
  appId: string
  /**
   * Portal URL for your ArcGIS organization (defaults to 'https://www.arcgis.com').
   * In order to use e.g. 'https://omnia.maps.arcgis.com', you will need to contact the
   * core Omnia Maps team and have them open up your app domains, to allow authentication
   * from those domains (CORS).
   * Read once when the provider mounts; changing it afterwards has no effect.
   */
  portalUrl?: string
  /**
   * Sign in through a popup window instead of redirecting the page, which is required inside iframes (e.g. Storybook).
   * Needs an `oauth-callback.html` page served at the root of your own app's origin, with its URL registered as a
   * redirect URI on your OAuth2 application. Read once when the provider mounts. Defaults to false.
   */
  popup?: boolean
}>

type OmniaMapsAuthContextValue = {
  authenticationStatus: OmniaMapsAuthenticationStatus
  handleSignIn: () => Promise<void>
}

const OmniaMapsAuthContext = createContext<OmniaMapsAuthContextValue | undefined>(undefined)

export function OmniaMapsAuthContextProvider(props: OmniaMapsAuthContextProviderProps) {
  const { appId, portalUrl = 'https://www.arcgis.com', popup = false } = props

  const [oAuthInfo] = useState(() => new OAuthInfo({ appId, portalUrl, popup }))
  useEffect(() => identityManager.registerOAuthInfos([oAuthInfo]), [oAuthInfo])

  const [authenticationStatus, setAuthenticationStatus] = useState<OmniaMapsAuthenticationStatus>('checking')

  useEffect(() => {
    let active = true

    identityManager
      .checkSignInStatus(`${portalUrl}/sharing`)
      .then(() => {
        if (active) setAuthenticationStatus('signed-in')
      })
      .catch(() => {
        if (active) setAuthenticationStatus('signed-out')
      })

    return () => {
      active = false
    }
  }, [portalUrl])

  async function handleSignIn() {
    setAuthenticationStatus('signing-in')

    try {
      await identityManager.getCredential(`${portalUrl}/sharing`)
      setAuthenticationStatus('signed-in')
    } catch {
      setAuthenticationStatus('signed-out')
    }
  }

  return (
    <OmniaMapsAuthContext.Provider
      value={{
        authenticationStatus,
        handleSignIn,
      }}
    >
      {props.children}
    </OmniaMapsAuthContext.Provider>
  )
}

export function useOmniaMapsAuth() {
  const context = useContext(OmniaMapsAuthContext)
  if (!context) {
    throw new Error('useOmniaMapsAuth must be used within an OmniaMapsAuthContextProvider')
  }
  return context
}
