import type { Row, Table } from '@tanstack/react-table'
import { useCallback, useState } from 'react'
import { useCopyToClipboard, useCustomToast } from '@/hooks'
import { getNestedValue } from '@/shared/utils'
import { AttributeType } from '@/shared/types'
import type { CellChange, CellCoordinates } from '../../utils/cellUtils'
import { getCellsInRange, getCellValuesAsText, mutateCells, parseClipboardValue } from '../../utils/cellUtils'

export type CellClipboard = ReturnType<typeof useCellClipboard>

export interface UseCellClipboardProps {
  table: Table<any>
  rows: Row<any>[]
  selectedCells: CellCoordinates[]
  record?: (changes: CellChange[]) => void
  editable: boolean
  deletionStrategy: 'remove' | 'nullify'
}

export function useCellClipboard({
  table,
  rows,
  selectedCells,
  record,
  editable,
  deletionStrategy,
}: UseCellClipboardProps) {
  const [copiedCells, setCopiedCells] = useState<CellCoordinates[]>([])
  const toast = useCustomToast()
  const { copy, isCopied } = useCopyToClipboard()

  const isCellCopied = useCallback(
    (rowId: string, columnId: string) => copiedCells.some((c) => c.rowId === rowId && c.columnId === columnId),
    [copiedCells]
  )

  const copySelectedCells = useCallback(async () => {
    await copy(getCellValuesAsText(table, selectedCells))
    setCopiedCells(selectedCells)
    setTimeout(() => setCopiedCells([]), 500)
  }, [table, selectedCells, copy])

  const pasteSelectedCells = useCallback(async () => {
    if (!editable || !table.options.meta?.setData) return
    const clipboardData = await navigator.clipboard.readText()
    if (!clipboardData) {
      toast.info('Something unexpected happened!', 'Clipboard is empty', 3000)
      return
    }

    const pastedRows = clipboardData.split('\n').filter((row) => row.length > 0)
    const firstSelectedCell = selectedCells[0]
    if (!firstSelectedCell) return

    const visibleColumns = table.getVisibleLeafColumns()
    const startColumnIndex = visibleColumns.findIndex((col) => col.id === firstSelectedCell.columnId)
    if (startColumnIndex === -1) return

    // Single row pasted into multiple selected cells → fill all selected
    if (pastedRows.length === 1 && selectedCells.length > 1) {
      const first = selectedCells[0]
      const last = selectedCells[selectedCells.length - 1]
      const cellsToUpdate = getCellsInRange(rows, visibleColumns, first, last)

      const changes = mutateCells(
        table,
        cellsToUpdate,
        ({ column }) => ({
          value: parseClipboardValue(pastedRows[0], column.columnDef.meta?.dataType),
        }),
        { editable, deletionStrategy }
      )
      record?.(changes)
      return
    }

    // Multi-row paste: use filtered rows for correct index mapping
    const keysToUpdate = visibleColumns
      .slice(startColumnIndex, startColumnIndex + pastedRows[0].split('\t').length)
      .map((col) => col.id)

    const selectedRowFilteredIndex = rows.findIndex((row) => row.id === firstSelectedCell.rowId)
    const targetRows = rows.slice(selectedRowFilteredIndex, selectedRowFilteredIndex + pastedRows.length)

    // Build a lookup: rowId → columnId → clipboard value
    const pasteMap = new Map<string, Map<string, string>>()
    for (let r = 0; r < targetRows.length; r++) {
      const values = pastedRows[r].split(/;|\t/)
      const columnValues = new Map<string, string>()
      for (let c = 0; c < keysToUpdate.length; c++) {
        if (values[c] !== undefined) {
          columnValues.set(keysToUpdate[c], values[c])
        }
      }
      pasteMap.set(targetRows[r].id, columnValues)
    }

    const cells: CellCoordinates[] = targetRows.flatMap((row) =>
      keysToUpdate.map((columnId) => ({ rowId: row.id, columnId }))
    )

    const changes = mutateCells(
      table,
      cells,
      ({ coord, column }) => {
        const raw = pasteMap.get(coord.rowId)?.get(coord.columnId)
        if (raw === undefined) return null
        return { value: parseClipboardValue(raw, column.columnDef.meta?.dataType) }
      },
      { editable, deletionStrategy }
    )
    record?.(changes)
  }, [table, rows, selectedCells, toast, record, editable, deletionStrategy])

  const deleteSelectedCells = useCallback(() => {
    if (selectedCells.length === 0) return
    const first = selectedCells[0]
    const last = selectedCells[selectedCells.length - 1]
    const cellsInRange = getCellsInRange(rows, table.getVisibleLeafColumns(), first, last)

    const changes = mutateCells(table, cellsInRange, () => ({ value: null }), { editable, deletionStrategy })
    record?.(changes)
  }, [table, rows, selectedCells, record, editable, deletionStrategy])

  const shortenDecimals = useCallback(
    (decimalPlaces: number, roundingMode: 'round' | 'floor' | 'ceil' = 'round') => {
      if (selectedCells.length === 0) return
      const first = selectedCells[0]
      const last = selectedCells[selectedCells.length - 1]
      const cellsInRange = getCellsInRange(rows, table.getVisibleLeafColumns(), first, last)
      const factor = 10 ** decimalPlaces
      const roundFn = roundingMode === 'floor' ? Math.floor : roundingMode === 'ceil' ? Math.ceil : Math.round

      const changes = mutateCells(
        table,
        cellsInRange,
        ({ row, column, accessorKey }) => {
          const dataType = column.columnDef.meta?.dataType
          if (dataType !== AttributeType.NUMBER) {
            toast.warning(
              'Unsupported action',
              `Shortening decimals is only supported for number columns (column: ${column.id})`
            )
            return null
          }
          const currentValue = getNestedValue(row, accessorKey)
          if (typeof currentValue !== 'number' || !Number.isFinite(currentValue)) return null
          const rounded = roundFn(currentValue * factor) / factor
          if (rounded === currentValue) return null
          return { value: rounded }
        },
        { editable, deletionStrategy }
      )
      record?.(changes)
    },
    [table, rows, selectedCells, toast, record, editable, deletionStrategy]
  )

  return {
    copiedCells,
    isCopied,
    isCellCopied,
    copySelectedCells,
    pasteSelectedCells,
    deleteSelectedCells,
    shortenDecimals,
  }
}
