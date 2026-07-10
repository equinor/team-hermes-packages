import type { Column, ColumnDef, Table } from '@tanstack/react-table'
import { AttributeType } from '../types'

/**
 * createColumnsForArrayTable
 * @param table
 * @returns Column definitions for array editor
 * @description
 * This function creates an array of column definitions for the the array datagrids.
 * It filters the columns of the provided table to include only those that are of type TEXT_ARRAY or NUMBER_ARRAY.
 * We also switch the data type to TEXT or NUMBER, as we go from an array of values to a single value per cell.
 */
export const createColumnsForArrayTable = <TData extends Record<string, any>>(
  table: Table<TData>
): ColumnDef<TData>[] => {
  const columns = []
  const tableColumns = table.getVisibleLeafColumns() as Column<TData>[]
  for (const column of tableColumns) {
    if (
      column.columnDef.meta?.dataType === AttributeType.TEXT_ARRAY ||
      column.columnDef.meta?.dataType === AttributeType.NUMBER_ARRAY
    ) {
      columns.push({
        id: column.id,
        accessorKey: column.id,
        size: column.getSize(),
        meta: {
          dataType:
            column.columnDef.meta?.dataType === AttributeType.TEXT_ARRAY ? AttributeType.TEXT : AttributeType.NUMBER,
          unit: column.columnDef.meta?.unit,
          minValue: column.columnDef.meta?.minValue,
          maxValue: column.columnDef.meta?.maxValue,
        },
      })
    }
  }
  return columns
}
