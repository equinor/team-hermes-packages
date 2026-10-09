export type AccessRole = {
  /** Value matched against `userRoles`, e.g. `admin`. */
  value: string
  /** Name shown on the chip, e.g. `Admin`. */
  label: string
}

export type AccessPermissionsPanelProps = {
  /** All roles the application defines, in display order. */
  roles: readonly AccessRole[]
  /** Values of the roles granted to the current user. */
  userRoles?: readonly string[]
  /** Shows skeleton chips instead of the role chips while the user's roles are loading. Defaults to `false`. */
  isLoading?: boolean
  /** Panel heading. Defaults to "Your Access & Permissions". */
  title?: string
  /** Heading level of the title. Defaults to `3`. */
  headingLevel?: 2 | 3 | 4 | 5
  /** Route to the access documentation. The help link is only rendered when this is set. */
  helpHref?: string
  /** Text of the help link. Defaults to "Access and Permissions". */
  helpLinkLabel?: string
  /** A router-aware link component (e.g. from React Router or TanStack Router). Must accept a `to` prop. Defaults to a plain anchor. */
  LinkComponent?: React.ComponentType<React.ComponentProps<'a'> & { to: string }>
  /** Whether to show the help link. Defaults to `true` only when the user has none of the roles. */
  showHelpLink?: boolean
}
