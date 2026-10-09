import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vite-plus/test'
import { AccessPermissionsPanel } from './AccessPermissionsPanel'
import type { AccessRole } from './AccessPermissionsPanel.types'

const roles: AccessRole[] = [
  { value: 'regularuser', label: 'Regular User' },
  { value: 'admin', label: 'Admin' },
  { value: 'datamanager', label: 'Data Manager' },
]

const baseProps = {
  roles,
  userRoles: ['admin'],
}

describe('AccessPermissionsPanel', () => {
  test('renders the default title as a labelled region', () => {
    render(<AccessPermissionsPanel {...baseProps} />)

    expect(screen.getByRole('heading', { name: 'Your Access & Permissions', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Your Access & Permissions' })).toBeInTheDocument()
  })

  test('renders a custom title at the given heading level', () => {
    render(<AccessPermissionsPanel {...baseProps} title="Your roles" headingLevel={4} />)

    expect(screen.getByRole('heading', { name: 'Your roles', level: 4 })).toBeInTheDocument()
  })

  test('shows access state per role', () => {
    render(<AccessPermissionsPanel {...baseProps} />)

    expect(screen.getByText('Admin: Access')).toBeInTheDocument()
    expect(screen.getByText('Regular User: No access')).toBeInTheDocument()
    expect(screen.getByText('Data Manager: No access')).toBeInTheDocument()
  })

  test('treats missing userRoles as no access', () => {
    render(<AccessPermissionsPanel roles={roles} />)

    expect(screen.getByText('Admin: No access')).toBeInTheDocument()
    expect(screen.getByText('Regular User: No access')).toBeInTheDocument()
  })

  test('shows two skeleton chips instead of role chips while loading', () => {
    const { container } = render(<AccessPermissionsPanel {...baseProps} isLoading />)

    expect(screen.queryByText('Admin: Access')).not.toBeInTheDocument()
    expect(screen.queryByText('Regular User: No access')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(2)
    expect(screen.getByRole('region', { name: 'Your Access & Permissions' })).toHaveAttribute('aria-busy', 'true')
  })

  test('shows the help link to users without any role', () => {
    const LinkComponent = vi.fn(({ to, ...rest }: React.ComponentProps<'a'> & { to: string }) => (
      <a href={to} {...rest} />
    ))
    render(
      <AccessPermissionsPanel {...baseProps} userRoles={[]} helpHref="/help/access" LinkComponent={LinkComponent} />
    )

    expect(screen.getByRole('link', { name: 'Access and Permissions' })).toHaveAttribute('href', '/help/access')
    expect(LinkComponent).toHaveBeenCalledWith(expect.objectContaining({ to: '/help/access' }), undefined)
  })

  test('hides the help link for users with a role by default', () => {
    render(<AccessPermissionsPanel {...baseProps} helpHref="/help/access" />)

    expect(screen.queryByRole('link', { name: 'Access and Permissions' })).not.toBeInTheDocument()
  })

  test('shows the help link for users with a role when showHelpLink is true', () => {
    render(<AccessPermissionsPanel {...baseProps} helpHref="/help/access" showHelpLink />)

    expect(screen.getByRole('link', { name: 'Access and Permissions' })).toBeInTheDocument()
  })

  test('hides the help link when showHelpLink is false, even without roles', () => {
    render(<AccessPermissionsPanel {...baseProps} userRoles={[]} helpHref="/help/access" showHelpLink={false} />)

    expect(screen.queryByRole('link', { name: 'Access and Permissions' })).not.toBeInTheDocument()
  })

  test('does not render a help link without helpHref', () => {
    render(<AccessPermissionsPanel roles={roles} userRoles={[]} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  test('hides the help link while loading', () => {
    render(<AccessPermissionsPanel roles={roles} isLoading helpHref="/help/access" />)

    expect(screen.queryByRole('link', { name: 'Access and Permissions' })).not.toBeInTheDocument()
  })

  test('uses a custom help link label', () => {
    render(<AccessPermissionsPanel roles={roles} userRoles={[]} helpHref="/help/access" helpLinkLabel="Roles" />)

    expect(screen.getByRole('link', { name: 'Roles' })).toBeInTheDocument()
  })
})
