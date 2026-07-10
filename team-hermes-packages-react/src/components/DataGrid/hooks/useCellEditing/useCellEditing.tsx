import type { Cell, Table } from '@tanstack/react-table'
import { useCallback, useState } from 'react'
import { formatDateForInput, getNestedValue } from '@/shared/utils'
import { AttributeType } from '@/shared/types'
import type { InputValue } from '../../DataGridBody/components/DataGridCell'
import type { CellCoordinates } from '../../utils/cellUtils'
import { getAccessorKey, isCellEditable } from '../../utils/cellUtils'

export type CellEditing = ReturnType<typeof useCellEditing>

export interface UseCellEditingProps {
  table: Table<any>
  tableBodyRef: React.RefObject<HTMLTableSectionElement | null>
  selectedCells: CellCoordinates[]
  editable: boolean
}

export function useCellEditing({ table, tableBodyRef, selectedCells, editable }: UseCellEditingProps) {
  const [activeEditingCell, setActiveEditingCell] = useState<CellCoordinates | null>(null)
  const [activeCommentingCell, setActiveCommentingCell] = useState<CellCoordinates | null>(null)
  const [editingCellValue, setEditingCellValue] = useState<InputValue>()

  const isCellEditing = useCallback(
    (cell: Cell<any, any>) =>
      activeEditingCell !== null &&
      activeEditingCell.rowId === cell.row.id &&
      activeEditingCell.columnId === cell.column.id,
    [activeEditingCell]
  )

  const isCellCommenting = useCallback(
    (cell: Cell<any, any>) =>
      activeCommentingCell !== null &&
      activeCommentingCell.rowId === cell.row.id &&
      activeCommentingCell.columnId === cell.column.id,
    [activeCommentingCell]
  )

  /**
   * @description Handles double click on a cell to enter edit mode. Allows the user to edit with the current cell value.
   * If the cell is of type date, formats the value for the date input. Otherwise, sets the raw value.
   * Also checks if the cell is editable before allowing editing.
   */
  const handleDoubleClick = useCallback(
    (cell: Cell<any, any>) => {
      if (!editable) return
      if (cell.column.columnDef.meta?.dataType === AttributeType.DATE_STRING) {
        setEditingCellValue(formatDateForInput(cell.getValue()) || '')
      } else {
        setEditingCellValue(cell.getValue())
      }
      setActiveEditingCell({ rowId: cell.row.id, columnId: cell.column.id })
    },
    [table, editable]
  )

  /**
   * @description Sets the currently selected cell as the active editing cell, allowing the user to start editing by typing.
   * Only works if a single cell is selected and is editable.
   */
  const setCurrentSelectedCellAsEditingCell = useCallback(() => {
    if (selectedCells.length !== 1) return
    if (!editable) return
    const selected = selectedCells[0]
    const column = table.getColumn(selected.columnId)
    if (!column) return
    const accessorKey = getAccessorKey(column)
    const rowValues = table.getRow(selected.rowId)?.original
    if (!rowValues) return
    const value = getNestedValue(rowValues, accessorKey)
    setEditingCellValue(value)
    setActiveEditingCell(selected)
  }, [selectedCells, table, editable])

  const startEditingWithValue = useCallback(
    (value: InputValue) => {
      if (selectedCells.length !== 1) return
      const selected = selectedCells[0]
      if (!isCellEditable(table, selected.columnId, editable)) return
      setEditingCellValue(value)
      setActiveEditingCell(selected)
    },
    [selectedCells, table]
  )

  const cancelEditing = useCallback(() => {
    setActiveEditingCell(null)
    tableBodyRef.current?.focus({ preventScroll: true })
  }, [tableBodyRef])

  /**
   * @description Sets the currently selected cell as the active commenting cell, allowing the user to add a comment.
   * If the cell is already the active commenting cell, it clears the commenting cell.
   */
  const setCommentingCell = useCallback(
    (clear?: boolean) => {
      if (clear) {
        setActiveCommentingCell(null)
        return
      }
      const lastSelected = selectedCells[selectedCells.length - 1]
      if (!lastSelected) return
      // When commenting, narrow selection to just that cell
      setActiveCommentingCell(lastSelected)
    },
    [selectedCells]
  )

  return {
    activeEditingCell,
    setActiveEditingCell,
    activeCommentingCell,
    editingCellValue,
    setEditingCellValue,
    isCellEditing,
    isCellCommenting,
    handleDoubleClick,
    setCurrentSelectedCellAsEditingCell,
    startEditingWithValue,
    cancelEditing,
    setCommentingCell,
  }
}
