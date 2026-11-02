import type { Table } from '@tanstack/react-table'
import { deepSet, getNestedValue } from '@/shared/utils'
import { AttributeType } from '@/shared/types'
import type { CellChange } from '../../utils/cellUtils'

/**
 * Hook that provides data mutation operations for the DataGrid.
 * Uses `setData` from table meta with `deepSet` for nested value support.
 * Calls `onCellsChanged` after each mutation for consumer-side effects.
 *
 * @param record Optional callback to record cell changes for undo/redo support.
 */
export function useDataGridUpdates<TData extends Record<string, any>>(
  table: Table<TData>,
  record?: (changes: CellChange[]) => void
) {
  const { setData, onCellsChanged } = table.options.meta ?? {}

  /**
   * Updates a single cell value using setData + deepSet.
   * Supports nested accessorKeys (e.g. "nested.field").
   * Automatically records the change for undo/redo if a record callback is provided.
   */
  function updateCellValue(rowIndex: number, columnId: string, value: unknown) {
    if (!setData) return

    const column = table.getColumn(columnId)
    const accessorKey = (column?.columnDef as any)?.accessorKey || columnId
    let oldValue: unknown = null

    setData((prev: any) => {
      const newData = [...prev]
      oldValue = getNestedValue(prev[rowIndex], accessorKey) ?? null
      const path = `${rowIndex}.${accessorKey}`
      deepSet(newData, path, value)
      return newData
    })

    onCellsChanged?.([{ rowIndex, columnId, value }])
    record?.([{ rowIndex, columnId, accessorKey, oldValue, newValue: value ?? null }])
  }

  /**
   * @description
   * Handles cell edit commit with type-specific parsing.
   * For NUMBER cells: parses comma-separated decimals, validates numeric input.
   * For TEXT/DATE cells: passes value through directly.
   */
  function commitCellEdit(rowIndex: number, columnId: string, rawValue: unknown, dataType?: AttributeType) {
    if (dataType === AttributeType.NUMBER) {
      const commaReplacedValue = String(rawValue)?.replace(',', '.')
      const numericValue = Number.parseFloat(commaReplacedValue)
      if (numericValue === null || rawValue === '') {
        updateCellValue(rowIndex, columnId, undefined)
        return true
      }
      if (Number.isNaN(numericValue)) {
        console.error(`Invalid number value for cell at row ${rowIndex}, column ${columnId}: ${rawValue as string}`)
        return false
      }
      updateCellValue(rowIndex, columnId, numericValue)
    } else {
      updateCellValue(rowIndex, columnId, rawValue)
    }
    return true
  }

  /**
   * @description
   * Adds rows to the data. Uses `defaultRowFactory` or `defaultRowValue` from table meta
   * if provided, otherwise creates empty objects.
   */
  function addRows(amount = 1, atIndex?: number) {
    if (!setData) return

    const factory = table.options.meta?.defaultRowFactory
    const defaultRow = table.options.meta?.defaultRowValue ?? ({} as TData)
    const newItems = Array.from({ length: amount }, () =>
      factory ? (factory() as TData) : (structuredClone(defaultRow) as TData)
    )

    setData((prev: any) => {
      const newData = [...prev]
      if (atIndex !== undefined && atIndex >= 0 && atIndex < newData.length) {
        newData.splice(atIndex, 0, ...newItems)
      } else {
        newData.push(...newItems)
      }
      return newData
    })
  }

  /**
   * @description
   * Removes a row at the given index.
   */
  function removeRow(rowIndex: number) {
    if (!setData) return

    setData((prev: any) => {
      const newData = [...prev]
      newData.splice(rowIndex, 1)
      return newData
    })
  }

  return {
    updateCellValue,
    commitCellEdit,
    addRows,
    removeRow,
  }
}
