//import { Popover } from '@base-ui/react/popover'
import { Button, Icon } from '@equinor/eds-core-react'
import { account_circle, block, check, log_out } from '@equinor/eds-icons'
import { Chip, Popover } from '@/components'

type UserPopoverProps = {
  logOut?: () => void
  user: {
    name: string
    email: string
    roles: string[]
  }
  APPLICATION_ROLES_LIST?: { value: string; label: string }[]
}

export function UserPopover(props: UserPopoverProps) {
  const { logOut, user, APPLICATION_ROLES_LIST } = props

  return (
    <Popover
      testIds={{
        portal: 'user-information-portal',
      }}
      trigger={
        <Button
          data-testid="user-information-button"
          aria-label="Toggle user information popover"
          variant="ghost_icon"
        >
          <Icon data={account_circle} size={24} />
        </Button>
      }
    >
      <div className="p-2 w-80 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Icon data={account_circle} size={24} color="var(--color-theme-success-fg)" />
          <div className="flex flex-col min-w-0">
            <span data-testid="username" className="font-medium truncate">
              {user?.name}
            </span>
            <span className="text-sm text-secondary truncate">{user?.email}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-overline">Permissions</span>
          <div className="flex flex-wrap gap-1.5">
            {APPLICATION_ROLES_LIST?.map((role) => (
              <Chip
                key={role.value}
                theme={user?.roles?.includes(role.value) ? 'success' : 'neutral'}
                icon={user?.roles?.includes(role.value) ? check : block}
                fontSize="xs"
              >
                {role.label}
              </Chip>
            ))}
          </div>
        </div>

        <hr className="border-stroke-subtle" />
        {logOut && (
          <button
            type="button"
            onClick={logOut}
            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-surface-hover text-left w-full"
          >
            <Icon data={log_out} size={18} />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </Popover>
  )
}
