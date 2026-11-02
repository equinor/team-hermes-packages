import type { Column, Row, Table } from '@tanstack/react-table'
import { deepSet, deleteByPath, getNestedValue } from '@/shared/utils'
import { AttributeType } from '@/shared/types'

export type CellCoordinates = {
  rowId: string
  columnId: string
}

/**
 * Check whether a cell is editable based on table-level and column-level settings.
 */
export function isCellEditable(table: Table<any>, columnId: string, editable = false): boolean {
  if (!editable) return false
  const column = table.getColumn(columnId)
  if (!column) return false
  if (column.columnDef.meta?.editable === false) return false
  const dataType = column.columnDef.meta?.dataType
  if (dataType === AttributeType.NUMBER_ARRAY || dataType === AttributeType.TEXT_ARRAY) return false
  return true
}

/**
 * Get the accessorKey for a column, falling back to the column ID.
 */
export function getAccessorKey(column: Column<any, unknown>): string {
  return (column.columnDef as any).accessorKey || column.id
}

/**
 * Build a tab-separated, newline-delimited string of cell values.
 * Used for copying to clipboard.
 */
export function getCellValuesAsText(table: Table<any>, cells: CellCoordinates[]): string {
  // Group cells by row, preserving visible column order
  const rowMap = new Map<string, Set<string>>()
  for (const { rowId, columnId } of cells) {
    let columnIds = rowMap.get(rowId)
    if (!columnIds) {
      columnIds = new Set()
      rowMap.set(rowId, columnIds)
    }
    columnIds.add(columnId)
  }

  const result: string[] = []
  for (const [rowId, columnIds] of rowMap) {
    const row = table.getRow(rowId)
    if (!row) continue
    const values: string[] = []
    for (const cell of row.getVisibleCells()) {
      if (columnIds.has(cell.column.id)) {
        values.push(String(cell.getValue() ?? ''))
      }
    }
    result.push(values.join('\t'))
  }
  return result.join('\n')
}

/**
 * Compute all cell coordinates in the rectangular region between two corners.
 * Uses the provided `rows` (already filtered/sorted from context).
 */
export function getCellsInRange(
  rows: Row<any>[],
  columns: Column<any, unknown>[],
  start: CellCoordinates,
  end: CellCoordinates
): CellCoordinates[] {
  const rowIndexMap = new Map(rows.map((r, i) => [r.id, i]))
  const colIndexMap = new Map(columns.map((c, i) => [c.id, i]))

  const startRowIdx = rowIndexMap.get(start.rowId)
  const endRowIdx = rowIndexMap.get(end.rowId)
  const startColIdx = colIndexMap.get(start.columnId)
  const endColIdx = colIndexMap.get(end.columnId)

  if (startRowIdx === undefined || endRowIdx === undefined || startColIdx === undefined || endColIdx === undefined) {
    return []
  }

  const minRow = Math.min(startRowIdx, endRowIdx)
  const maxRow = Math.max(startRowIdx, endRowIdx)
  const minCol = Math.min(startColIdx, endColIdx)
  const maxCol = Math.max(startColIdx, endColIdx)

  const result: CellCoordinates[] = []
  for (let r = minRow; r <= maxRow; r++) {
    const row = rows[r]
    for (let c = minCol; c <= maxCol; c++) {
      result.push({ rowId: row.id, columnId: columns[c].id })
    }
  }
  return result
}

/**
 * Parse a clipboard string value into the appropriate type for a cell.
 */
export function parseClipboardValue(raw: string, dataType?: AttributeType): unknown {
  if (raw.trim() === '') return null
  if (dataType === AttributeType.NUMBER) {
    return Number(raw.replace(',', '.'))
  }
  return raw
}

/**
 * Represents a single cell value change with before/after values.
 * Used by the undo/redo system to replay or reverse mutations.
 */
export type CellChange = {
  rowIndex: number
  columnId: string
  accessorKey: string
  oldValue: unknown
  newValue: unknown
}

/**
 * Context passed to a cell mutation transform function.
 */
export type CellMutationContext = {
  /** The row data being modified (from the cloned array). */
  row: Record<string, any>
  /** The original row index in the data array. */
  rowIndex: number
  /** The TanStack column definition. */
  column: Column<any, unknown>
  /** The resolved accessor key (supports nested paths). */
  accessorKey: string
  /** The cell coordinates being processed. */
  coord: CellCoordinates
}

/**
 * Iterate over a set of cells and apply a transform to each editable cell.
 *
 * Handles all the shared boilerplate:
 * - Guard: checks `editable` and `setData` on table meta
 * - Per-cell: skips non-editable cells, resolves rowIndex/column/accessorKey
 * - Write: uses `deepSet` for values, or `deleteByPath`/`nullify` for deletions
 * - Fires `onCellsChanged` with all changed cells
 *
 * @param transform Return `{ value }` to set a value (`null` → apply deletion strategy),
 *   or return `null` to skip the cell.
 * @returns Array of cell changes with old/new values for undo/redo support.
 */
export function mutateCells(
  table: Table<any>,
  cells: CellCoordinates[],
  transform: (ctx: CellMutationContext) => { value: unknown } | null,
  options: { editable: boolean; deletionStrategy: 'remove' | 'nullify' } = {
    editable: false,
    deletionStrategy: 'remove',
  }
): CellChange[] {
  const { setData, onCellsChanged } = table.options.meta ?? {}
  const { editable, deletionStrategy } = options
  if (!editable || !setData) return []

  const rowLookupById = table.getRowModel().rowsById
  const changedCells: { rowIndex: number; columnId: string; value: unknown }[] = []
  const cellChanges: CellChange[] = []

  // Pre-compute which cells to mutate and their old values using current row data.
  // This avoids relying on setData's updater running synchronously.
  type PendingMutation = {
    coord: CellCoordinates
    rowIndex: number
    column: Column<any, unknown>
    accessorKey: string
    oldValue: unknown
    newValue: unknown
  }
  const pending: PendingMutation[] = []

  for (const coord of cells) {
    if (!isCellEditable(table, coord.columnId, editable)) continue
    const tableRow = rowLookupById[coord.rowId]
    const rowIndex = tableRow?.index
    if (rowIndex === undefined) continue
    const column = table.getColumn(coord.columnId)
    if (!column) continue
    const accessorKey = getAccessorKey(column)
    const row = tableRow.original as Record<string, any>

    const result = transform({ row, rowIndex, column, accessorKey, coord })
    if (!result) continue

    const oldValue = getNestedValue(row, accessorKey) ?? null
    const { value } = result

    pending.push({ coord, rowIndex, column, accessorKey, oldValue, newValue: value ?? null })
  }

  if (pending.length === 0) return []

  setData((prev: any) => {
    const newData = [...prev]
    for (const { rowIndex, accessorKey, newValue } of pending) {
      const row = newData[rowIndex]
      if (!row) continue
      if (newValue === null) {
        if (deletionStrategy === 'nullify') {
          deepSet(newData, `${rowIndex}.${accessorKey}`, null)
        } else {
          deleteByPath(row, accessorKey)
        }
      } else {
        deepSet(newData, `${rowIndex}.${accessorKey}`, newValue)
      }
    }
    return newData
  })

  for (const { rowIndex, coord, accessorKey, oldValue, newValue } of pending) {
    changedCells.push({ rowIndex, columnId: coord.columnId, value: newValue })
    cellChanges.push({ rowIndex, columnId: coord.columnId, accessorKey, oldValue, newValue })
  }

  if (changedCells.length > 0) {
    onCellsChanged?.(changedCells)
  }

  return cellChanges
}
