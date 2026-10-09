import { Typography } from '@equinor/eds-core-react'
import { block, check } from '@equinor/eds-icons'
import { useId } from 'react'
import { Chip } from '../Chip/Chip'
import type { AccessPermissionsPanelProps } from './AccessPermissionsPanel.types'

const skeletonChipWidths = ['w-36', 'w-44']

const DefaultLink = ({ to, ...rest }: React.ComponentProps<'a'> & { to: string }) => <a href={to} {...rest} />

/**
 * Homepage panel that shows which application roles the current user has, as
 * a chip per role. Optionally links to the access documentation, by default
 * only for users without any of the roles.
 */
export function AccessPermissionsPanel(props: AccessPermissionsPanelProps) {
  const {
    roles,
    userRoles,
    isLoading = false,
    title = 'Your Access & Permissions',
    headingLevel = 3,
    helpHref,
    helpLinkLabel = 'Access and Permissions',
    LinkComponent = DefaultLink,
    showHelpLink,
  } = props

  const headingId = useId()
  const hasAnyRole = roles.some((role) => userRoles?.includes(role.value))
  const isHelpLinkVisible = !isLoading && (showHelpLink ?? !hasAnyRole)

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={isLoading}
      className="bg-surface text-primary shadow-(--box-elevation) rounded p-6 flex flex-col gap-4"
    >
      <Typography id={headingId} variant="h5" as={`h${headingLevel}`} token={{ fontWeight: 'bold' }}>
        {title}
      </Typography>

      {isLoading ? (
        <ul aria-hidden="true" className="flex flex-wrap gap-3 m-0 p-0 list-none">
          {roles.map((role, index) => (
            <li key={role.value}>
              <div
                className={`${skeletonChipWidths[index % skeletonChipWidths.length]} h-6.5 rounded-full bg-(--eds-color-bg-fill-muted-default) animate-pulse`}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-wrap gap-3 m-0 p-0 list-none">
          {roles.map((role) => {
            const hasRole = !!userRoles?.includes(role.value)
            return (
              <li key={role.value}>
                <Chip theme={hasRole ? 'success' : 'neutral'} icon={hasRole ? check : block}>
                  {`${role.label}: ${hasRole ? 'Access' : 'No access'}`}
                </Chip>
              </li>
            )
          })}
        </ul>
      )}

      {isHelpLinkVisible && helpHref && (
        <div className="flex flex-col gap-1">
          <Typography>See info about access and roles here:</Typography>
          <LinkComponent to={helpHref} className="text-link self-start">
            {helpLinkLabel}
          </LinkComponent>
        </div>
      )}
    </section>
  )
}
