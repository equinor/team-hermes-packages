import { Menu } from '@base-ui/react'
import { Icon } from '@equinor/eds-core-react'
import {
  arrow_down,
  arrow_up,
  delete_forever,
  more_vertical,
  select_all,
  thumb_pin,
  visibility_off,
} from '@equinor/eds-icons'
import type { Header, Table } from '@tanstack/react-table'
import { useState } from 'react'
import { ConfirmOperationDialog } from '@/components'
import type { CellActions } from '../../context/DataGridContext'
import { ColumnPinningDirection } from '../../DataGrid.types'

type DataGridHeaderCellMenuProps<TData extends Record<string, any>> = {
  header: Header<TData, unknown>
  table: Table<TData>
  cellActions: CellActions
}

export function DataGridHeaderCellMenu<TData extends Record<string, any>>(props: DataGridHeaderCellMenuProps<TData>) {
  const { header, table, cellActions } = props
  const isPinned = header.column.getIsPinned()
  const canHide = header.column.getCanHide()
  const canSort = header.column.getCanSort()
  const hideStrategy = canHide && table.options?.meta?.removeColumn ? 'remove' : 'toggle'
  const [showDeleteConfirmationDialog, setShowDeleteConfirmationDialog] = useState(false)

  function handleColumnRemove() {
    if (typeof table.options.meta?.removeColumn === 'function') {
      table.options.meta.removeColumn(header.id)
      header.column.toggleVisibility(false)
      setShowDeleteConfirmationDialog(false)
    }
  }

  const handleColumnToggle = () => {
    if (hideStrategy === 'remove') {
      setShowDeleteConfirmationDialog(true)
      return
    }
    header.column.toggleVisibility(false)
  }

  return (
    <>
      <ConfirmOperationDialog
        title="Remove Column"
        description={`Removing ${header.id} will also remove all measurement data entered for this sample for all sample groups. Are you sure you want to perform this action?`}
        isOpen={showDeleteConfirmationDialog}
        setIsOpen={setShowDeleteConfirmationDialog}
        onConfirm={handleColumnRemove}
      />
      <Menu.Root>
        <Menu.Trigger aria-label={`Open action menu for column: ${header.id}`}>
          <Icon data={more_vertical} size={16} />
        </Menu.Trigger>
        <Menu.Portal className="z-5">
          <Menu.Positioner sideOffset={8}>
            <Menu.Popup className="menu-popup">
              <Menu.Item className="menu-item" onClick={() => cellActions.setSelectedCellsByColumn(header.id)}>
                <Icon data={select_all} size={16} />
                Select All
              </Menu.Item>
              {canHide && (
                <Menu.Item className="menu-item" onClick={handleColumnToggle}>
                  <Icon data={hideStrategy === 'remove' ? delete_forever : visibility_off} size={16} />
                  {hideStrategy === 'remove' ? 'Remove column' : 'Hide column'}
                </Menu.Item>
              )}
              {canSort && (
                <>
                  <Menu.Group>
                    <Menu.GroupLabel className="menu-group-label">Sort</Menu.GroupLabel>
                    <Menu.Item className="menu-item" onClick={() => header.column.toggleSorting(false)}>
                      <Icon data={arrow_up} size={16} />
                      Ascending
                    </Menu.Item>
                    <Menu.Item className="menu-item" onClick={() => header.column.toggleSorting(true)}>
                      <Icon data={arrow_down} size={16} />
                      Descending
                    </Menu.Item>
                  </Menu.Group>
                  <Menu.Separator className="h-px bg-stroke-subtle" />
                </>
              )}
              <Menu.Group>
                <Menu.GroupLabel className="menu-group-label">Pin</Menu.GroupLabel>
                {isPinned && (
                  <Menu.Item className="menu-item" onClick={() => header.column.pin(false)}>
                    <Icon data={thumb_pin} size={16} /> Unpin
                  </Menu.Item>
                )}
                {isPinned !== ColumnPinningDirection.LEFT && (
                  <Menu.Item className="menu-item" onClick={() => header.column.pin(ColumnPinningDirection.LEFT)}>
                    <Icon data={thumb_pin} size={16} /> Pin Left
                  </Menu.Item>
                )}
                {isPinned !== ColumnPinningDirection.RIGHT && (
                  <Menu.Item className="menu-item" onClick={() => header.column.pin(ColumnPinningDirection.RIGHT)}>
                    <Icon data={thumb_pin} size={16} style={{ transform: 'scaleX(-1)' }} /> Pin Right
                  </Menu.Item>
                )}
              </Menu.Group>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </>
  )
}
