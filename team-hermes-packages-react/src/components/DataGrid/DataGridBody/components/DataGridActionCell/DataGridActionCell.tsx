import { Icon } from '@equinor/eds-core-react'
import { add, check_circle_outlined, copy, delete_forever, error_outlined, warning_outlined } from '@equinor/eds-icons'
import type { Row } from '@tanstack/react-table'
import { useRef, useState } from 'react'
import { ContextMenu } from '../../../../ContextMenu/ContextMenu'
import { useDataGridContext } from '../../../context/DataGridContext'

type DataGridActionCellProps<TData extends Record<string, any>> = {
  index: number
  row: Row<TData>
  hasError: boolean
  hasWarning: boolean
}

export const DataGridActionCell = <TData extends Record<string, any>>(props: DataGridActionCellProps<TData>) => {
  const { index, row } = props
  const { table, cellActions, tableContainerRef, addRows, removeRow, editable, enableAddRows, enableRemoveRows } =
    useDataGridContext<TData>()

  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState<boolean>(false)
  const actionsMenuButtonRef = useRef<HTMLButtonElement>(null)
  const validationColumn = editable ? table.getColumn('validation_column') : null

  function handleAddRow(amount = 1, atIndex?: 'current' | 'after') {
    table.resetSorting(true)
    const rowIndex = table.getFilteredRowModel().rowsById[row.id].index
    const calculatedAtIndex = atIndex === 'after' ? rowIndex + 1 : rowIndex
    addRows(amount, calculatedAtIndex)
    const currentRowsLength = table.getFilteredRowModel().rows.length
    if (cellActions.scrollToRow === undefined) return
    cellActions.scrollToRow(atIndex !== undefined ? calculatedAtIndex : currentRowsLength + amount, {
      align: 'center',
      behavior: 'smooth',
    })
  }

  function handleRemoveRow() {
    const rowIndex = table.getFilteredRowModel().rowsById[row.id].index
    removeRow(rowIndex)
    cellActions.setActiveEditingCell(null)
  }

  return (
    <div
      className="flex items-center bg-surface border-b border-stroke-subtle"
      style={{ width: validationColumn ? '96px' : '48px' }}
    >
      <button
        aria-label="Right click to open row actions menu"
        className="text-right w-12 h-full px-2 hover:bg-surface-hover"
        ref={actionsMenuButtonRef}
        onClick={() => cellActions.setSelectedCellsByRow(row.id)}
        onContextMenu={(e) => {
          e.preventDefault()
          cellActions.setSelectedCellsByRow(row.id)
          setIsActionsMenuOpen(true)
        }}
      >
        {index + 1}
      </button>
      {validationColumn && (
        <div className="flex items-center" style={{ width: 48 }}>
          <Icon
            data={props.hasError ? error_outlined : props.hasWarning ? warning_outlined : check_circle_outlined}
            color={
              props.hasError
                ? 'var(--color-theme-danger-fg)'
                : props.hasWarning
                  ? 'var(--color-theme-warning-fg)'
                  : 'var(--color-theme-success-fg)'
            }
            size={24}
          />
        </div>
      )}

      <ContextMenu
        container={tableContainerRef}
        triggerId={`row-actions-menu-${index}`}
        triggerRef={actionsMenuButtonRef}
        open={isActionsMenuOpen}
        setIsOpen={setIsActionsMenuOpen}
        items={[
          {
            label: 'Copy',
            icon: copy,
            onClick: () => cellActions.copySelectedCells(),
          },
          {
            label: 'Remove row',
            icon: delete_forever,
            onClick: handleRemoveRow,
            hidden: !enableRemoveRows,
          },
          {
            label: 'Add row',
            icon: add,
            hidden: !enableAddRows,
            subItems: [
              { label: 'Add row above', onClick: () => handleAddRow(1, 'current') },
              { label: 'Add row below', onClick: () => handleAddRow(1, 'after') },
            ],
          },
        ]}
      />
    </div>
  )
}
