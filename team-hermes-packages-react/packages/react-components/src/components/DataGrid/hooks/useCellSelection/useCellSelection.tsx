import type { Cell, Row, Table } from '@tanstack/react-table'
import { useCallback, useMemo, useState } from 'react'
import { stringToPath } from 'remeda'
import { useOutsideClick } from '@/hooks'
import type { CellCoordinates } from '../../utils/cellUtils'
import { getCellsInRange } from '../../utils/cellUtils'

export type CellSelection = ReturnType<typeof useCellSelection>

export interface UseCellSelectionProps {
  table: Table<any>
  rows: Row<any>[]
  scrollToRow?: (index: number, options?: Record<string, any>) => void
  scrollToColumn?: (columnId: string) => void
  containerRef: React.RefObject<HTMLElement | null>
  validationErrors?: Record<string, string>
  validationWarnings?: Record<string, string>
}

export function useCellSelection({
  table,
  rows,
  scrollToRow,
  scrollToColumn,
  containerRef,
  validationErrors,
  validationWarnings,
}: UseCellSelectionProps) {
  const [selectedCells, setSelectedCells] = useState<CellCoordinates[]>([])
  const [selectionStart, setSelectionStart] = useState<CellCoordinates | null>(null)
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [selectedErrorIndex, setSelectedErrorIndex] = useState(-1)
  const [selectedWarningIndex, setSelectedWarningIndex] = useState(-1)
  const validationKeyPrefix = table.options.meta?.validationKeyPrefix || 'rowIndex'

  // Clear selection when clicking outside the container
  useOutsideClick([containerRef], () => setSelectedCells([]))

  const visibleColumns = table.getVisibleLeafColumns()

  // O(1) lookup for selected cells via Set
  const selectedCellKeys = useMemo(
    () => new Set(selectedCells.map((c) => `${c.rowId}_${c.columnId}`)),
    [selectedCells]
  )

  /**
   * @description  Given a start and end coordinate, compute all cells in the rectangular range defined by them.
   */
  const computeRange = useCallback(
    (start: CellCoordinates, end: CellCoordinates): CellCoordinates[] => {
      return getCellsInRange(rows, visibleColumns, start, end)
    },
    [rows, visibleColumns]
  )

  /**
   * @description Select a single cell, replacing the current selection. Optionally scrolls to the cell.
   */
  const setCellSelection = useCallback(
    (cell: Cell<any, any>, scroll?: 'smooth' | 'auto' | 'none') => {
      const coord: CellCoordinates = { rowId: cell.row.id, columnId: cell.column.id }

      // Track error navigation
      const errorPath = `[${cell.row.index}].${cell.column.id}`
      if (validationErrors?.[errorPath]) {
        setSelectedErrorIndex(Object.keys(validationErrors).indexOf(errorPath))
      } else {
        setSelectedErrorIndex(-1)
      }

      setSelectedCells([coord])
      setSelectionStart(coord)

      if (scroll !== 'none') {
        scrollToRow?.(cell.row.index, { behavior: scroll, align: 'center' })
      }
    },
    [validationErrors, scrollToRow]
  )

  const clearSelection = useCallback(() => {
    setSelectedCells([])
    setSelectionStart(null)
  }, [])

  /**
   * @description Select all cells in a given row
   */
  const setSelectedCellsByRow = useCallback(
    (rowId: string) => {
      const row = table.getRow(rowId)
      if (!row) return
      const cells = row.getVisibleCells()
      const first = cells[0]
      const last = cells[cells.length - 1]
      if (!first || !last) return
      const start: CellCoordinates = { rowId: first.row.id, columnId: first.column.id }
      const end: CellCoordinates = { rowId: last.row.id, columnId: last.column.id }
      setSelectedCells(computeRange(start, end))
    },
    [table, computeRange]
  )

  /**
   * @description Select all cells in a given column
   */
  const setSelectedCellsByColumn = useCallback(
    (columnId: string) => {
      if (rows.length === 0) return
      const start: CellCoordinates = { rowId: rows[0].id, columnId }
      const end: CellCoordinates = { rowId: rows[rows.length - 1].id, columnId }
      setSelectedCells(computeRange(start, end))
    },
    [rows, computeRange]
  )

  /**
   * @description Update the current selection to include all cells in the range from the initial selectionStart to the given cell
   */
  const updateRangeSelection = useCallback(
    (cell: Cell<any, any>) => {
      if (!selectionStart) return
      const end: CellCoordinates = { rowId: cell.row.id, columnId: cell.column.id }
      const ranged = computeRange(selectionStart, end)
      setSelectedCells(ranged)
    },
    [selectionStart, computeRange]
  )

  /**
   * @description Mouse down on a cell can have 3 effects:
   * 1) No modifier keys: select the cell
   * 2) Ctrl/Cmd: toggle the cell's selection
   * 3) Shift: extend the current selection from the initial selectionStart to the clicked cell
   * Additionally, mouse over while holding down the button and shift key will extend the selection to the hovered cell.
   * Mouse up will end the drag selection.
   */
  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>, cell: Cell<any, any>) => {
      if (!e.shiftKey) {
        setCellSelection(cell, 'none')
      }

      if (e.shiftKey) {
        updateRangeSelection(cell)
      }

      setIsMouseDown(true)
    },
    [setCellSelection, updateRangeSelection]
  )

  /**
   * @description If the mouse is down and the user hovers over a cell, extend the selection to that cell (enabling drag selection)
   */
  const handleCellMouseOver = useCallback(
    (e: React.MouseEvent<HTMLElement>, cell: Cell<any, any>) => {
      if (e.buttons !== 1) return
      if (isMouseDown) {
        updateRangeSelection(cell)
      }
    },
    [isMouseDown, updateRangeSelection]
  )

  const handleCellMouseUp = useCallback(() => setIsMouseDown(false), [])

  /**
   * @description Keyboard navigation to update the selection.
   * Shift + Arrow keys will extend the selection, while regular Arrow keys will move the selection to the next cell.
   */
  const navigateRow = useCallback(
    (direction: 'up' | 'down', shiftKey: boolean) => {
      const lastSelectedCell = direction === 'up' ? selectedCells[0] : selectedCells[selectedCells.length - 1]
      if (!lastSelectedCell) return

      const selectedRowIndex = rows.findIndex((row) => row.id === lastSelectedCell.rowId)
      const newRowIndex = direction === 'up' ? selectedRowIndex - 1 : selectedRowIndex + 1
      const nextRow = rows[newRowIndex]
      if (!nextRow) return

      const selectedCell = nextRow.getVisibleCells().find((c) => c.column.id === lastSelectedCell.columnId)
      if (!selectedCell) return

      if (shiftKey) {
        updateRangeSelection(selectedCell)
      } else {
        setCellSelection(selectedCell)
      }
    },
    [selectedCells, rows, updateRangeSelection, setCellSelection]
  )

  /**
   * @description Navigate left/right to the next cell. Does not wrap around rows.
   * Shift + Arrow will extend the selection, while regular Arrow will move the selection to the next cell.
   */
  const navigateCell = useCallback(
    (direction: 'left' | 'right') => {
      const selectedCell = selectedCells[selectedCells.length - 1]
      if (!selectedCell) return
      const row = table.getRow(selectedCell.rowId)
      if (!row) return
      const cells = row.getVisibleCells()
      const colIndex = cells.findIndex((c) => c.column.id === selectedCell.columnId)
      const newCell = direction === 'left' ? cells[colIndex - 1] : cells[colIndex + 1]
      if (newCell) {
        setCellSelection(newCell, 'none')
      }
    },
    [selectedCells, table, setCellSelection]
  )

  /**
   * @description Navigate to the first cell in the table
   */
  const navigateHome = useCallback(() => {
    const firstCell = rows[0]?.getVisibleCells()[0]
    if (firstCell) setCellSelection(firstCell, 'auto')
  }, [rows, setCellSelection])

  /**
   * @description Navigate to the last cell in the table
   */
  const navigateEnd = useCallback(() => {
    const lastRow = rows[rows.length - 1]
    const cells = lastRow?.getVisibleCells()
    const lastCell = cells?.[cells.length - 1]
    if (lastCell) setCellSelection(lastCell, 'auto')
  }, [rows, setCellSelection])

  /**
   * @description Navigate to the next/previous error or warning cell, or directly to a specific error cell by index.
   * If the target is a row, the entire row will be selected. Optionally scrolls to the cell.
   */
  const selectErrorCell = useCallback(
    (errorIndex: number | 'next' | 'previous', type: 'warning' | 'error') => {
      const messages = type === 'error' ? validationErrors : validationWarnings
      const currentIndex = type === 'error' ? selectedErrorIndex : selectedWarningIndex
      const setIndex = type === 'error' ? setSelectedErrorIndex : setSelectedWarningIndex
      if (!messages) return

      const keys = Object.keys(messages)
      const total = keys.length
      let newIndex = 0

      if (errorIndex === 'next') newIndex = currentIndex + 1 >= total ? 0 : currentIndex + 1
      else if (errorIndex === 'previous') newIndex = currentIndex <= 0 ? total - 1 : currentIndex - 1
      else newIndex = errorIndex

      const nextError = keys[newIndex]
      if (!nextError) return

      const [rowIndex, ...parts] = stringToPath(nextError) as [number, ...string[]]
      const columnId = parts[parts.length - 1] as string
      const rowId = rows[rowIndex]?.id
      if (!rowId) return

      if (!columnId) {
        setSelectedCellsByRow(rowId)
        setIndex(newIndex)
        scrollToRow?.(rowIndex as number, { behavior: 'smooth', align: 'center' })
        return
      }
      setSelectedCells([{ rowId, columnId }])
      setIndex(newIndex)
      scrollToRow?.(rowIndex as number, { behavior: 'smooth', align: 'center' })
      if (columnId) scrollToColumn?.(columnId)
    },
    [
      validationErrors,
      validationWarnings,
      selectedErrorIndex,
      selectedWarningIndex,
      rows,
      scrollToRow,
      scrollToColumn,
      setSelectedCellsByRow,
    ]
  )

  /**
   * @description Check if a given row has any validation errors
   */
  const rowHasErrors = useCallback(
    (rowId: string) => {
      if (!validationErrors) return false
      const prefix = validationKeyPrefix === 'rowId' ? `[${rowId}]` : `[${table.getRow(rowId)?.index}]`
      return Object.keys(validationErrors).some((key) => key.startsWith(prefix))
    },
    [validationErrors, validationKeyPrefix, table]
  )

  /**
   * @description Check if a given row has any validation warnings
   */
  const rowHasWarnings = useCallback(
    (rowId: string) => {
      if (!validationWarnings) return false
      const prefix = validationKeyPrefix === 'rowId' ? `[${rowId}]` : `[${table.getRow(rowId)?.index}]`
      return Object.keys(validationWarnings).some((key) => key.startsWith(prefix))
    },
    [validationWarnings, validationKeyPrefix, table]
  )

  /**
   * @description Check if a given cell is selected, or if any cell in a given row is selected
   */
  const isCellSelected = useCallback(
    (cell: Cell<any, any>) => selectedCellKeys.has(`${cell.row.id}_${cell.column.id}`),
    [selectedCellKeys]
  )

  /**
   * @description Check if any cell in a given row is selected
   */
  const isRowSelected = useCallback((rowId: string) => selectedCells.some((c) => c.rowId === rowId), [selectedCells])

  return {
    selectedCells,
    setSelectedCells,
    selectionStart,
    isCellSelected,
    isRowSelected,
    setCellSelection,
    clearSelection,
    setSelectedCellsByRow,
    setSelectedCellsByColumn,
    handleCellMouseDown,
    handleCellMouseOver,
    handleCellMouseUp,
    navigateRow,
    navigateCell,
    navigateHome,
    navigateEnd,
    selectErrorCell,
    selectedErrorIndex,
    selectedWarningIndex,
    rowHasErrors,
    rowHasWarnings,
    scrollToRow,
    scrollToColumn,
  }
}
