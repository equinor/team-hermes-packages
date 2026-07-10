import { comment, copy, edit, filter_list, keyboard_backspace, paste } from '@equinor/eds-icons'
import type { Cell } from '@tanstack/react-table'
import { useFilterActions } from '@/hooks'
import { ContextMenu } from '@/index'
import { useDataGridContext } from '../../../context/DataGridContext'
import { AttributeType, FilterOperator, type FilterValue } from '@/shared/types'

type DataGridCellContextMenuProps<TData extends Record<string, any>> = {
  cellRef: React.RefObject<HTMLButtonElement | null>
  cell: Cell<TData, unknown>
  cellId: string
  isContextMenuOpen: boolean
  setIsContextMenuOpen: (open: boolean) => void
}

export function DataGridCellContextMenu<TData extends Record<string, any>>(
  props: DataGridCellContextMenuProps<TData>
) {
  const { cellRef, cell, cellId, isContextMenuOpen, setIsContextMenuOpen } = props
  const { tableBodyRef, cellActions, editable, commentConfig, table, filterable } = useDataGridContext<TData>()
  const { getOperatorOptions, updateFilterValue } = useFilterActions()

  const isSingleCellSelected = cellActions.selectedCells.length === 1
  const dataType = cell.column.columnDef.meta?.dataType
  const isArrayColumn = dataType === AttributeType.TEXT_ARRAY || dataType === AttributeType.NUMBER_ARRAY
  const cellValue = cell.getValue()
  const hasCellValue = cellValue !== null && cellValue !== undefined && cellValue !== ''
  const showFilterOption =
    isSingleCellSelected && !isArrayColumn && hasCellValue && cell.column.getCanFilter() && filterable

  const handleAddColumnFilter = (operator: FilterOperator) => {
    const current: FilterValue = (cell.column.getFilterValue() as FilterValue) ?? []
    const isClientSide = table.options.manualFiltering !== true
    if (isClientSide) {
      cell.column.setFilterValue({
        operator,
        value: String(cell.getValue() ?? ''),
        dataType: cell.column.columnDef.meta?.dataType,
      })
    } else {
      cell.column.setFilterValue(updateFilterValue(current, operator, String(cell.getValue() ?? '')))
    }
  }

  const operators = getOperatorOptions(cell.column)
  const operatorsMenuItems = operators.map((op) => ({
    label: op.label,
    onClick: () => handleAddColumnFilter(op.value as FilterOperator),
  }))

  return (
    <ContextMenu
      triggerRef={cellRef}
      triggerId={cellId}
      open={isContextMenuOpen}
      setIsOpen={setIsContextMenuOpen}
      container={tableBodyRef}
      items={[
        {
          label: 'Edit',
          onClick: () => cellActions.handleDoubleClick(cell),
          shortcut: 'SPACE',
          hidden: !editable,
          icon: edit,
        },
        {
          label: 'Copy',
          onClick: () => cellActions.copySelectedCells(),
          shortcut: 'Ctrl+C',
          icon: copy,
        },
        {
          label: 'Paste',
          onClick: () => cellActions.pasteSelectedCells(),
          shortcut: 'Ctrl+V',
          hidden: !editable,
          icon: paste,
        },
        {
          label: 'Clear Cell',
          onClick: () => cellActions.deleteSelectedCells(),
          shortcut: 'Backspace',
          hidden: !editable,
          icon: keyboard_backspace,
        },
        {
          label: 'Comment',
          onClick: () => cellActions.setCommentingCell(),
          shortcut: 'Ctrl+E',
          hidden: !commentConfig?.enabled,
          icon: comment,
        },
        {
          label: 'Filter by',
          hidden: !showFilterOption,
          subItems: operatorsMenuItems,
          icon: filter_list,
        },
      ]}
    />
  )
}
