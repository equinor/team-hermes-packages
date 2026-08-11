import { Menu } from '@base-ui/react'
import { Icon } from '@equinor/eds-core-react'
import { arrow_down, arrow_up, chevron_down, swap_vertical } from '@equinor/eds-icons'
import { flexRender, type Table } from '@tanstack/react-table'

type SortingButtonProps<T> = {
  table: Table<T>
}

export function SortingButton<T>(props: SortingButtonProps<T>) {
  const { table } = props
  const activeSortingId = table.getState().sorting[0]?.id
  const activeSorting = activeSortingId
    ? table.getLeafHeaders().find((header) => header.id === activeSortingId)?.column.columnDef.header
    : undefined
  const headers = table.getLeafHeaders()

  return (
    <Menu.Root>
      <Menu.Trigger className="flex items-center gap-4">
        <Icon data={swap_vertical} size={18} color="var(--color-theme-accent-fg)" />
        <span>
          <b>Order by: </b>
          {(activeSorting as string) ?? 'None'}
        </span>
        <Icon data={chevron_down} size={18} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup className="menu-popup">
            {headers.map((header) => {
              if (!header.column.getCanSort()) return null
              const sortDirection =
                typeof header.column.getIsSorted === 'function' ? (header.column.getIsSorted() as string) : null
              return (
                <Menu.Item
                  className="px-4 py-2 flex items-center gap-4 hover:bg-surface-hover cursor-pointer"
                  key={header.id}
                  onClick={() => {
                    header.column.toggleSorting()
                  }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {sortDirection && <Icon data={sortDirection === 'desc' ? arrow_down : arrow_up} size={16} />}
                </Menu.Item>
              )
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
