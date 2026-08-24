import type { ColumnDef, Row, TableOptions } from '@tanstack/react-table'
import {
  getCoreRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo } from 'react'
import { filterFn } from './DataGrid.utils'

type ValidationFilterValue = 'success' | 'warning' | 'error'

export type UseDataGridOptions<TData extends Record<string, any>> = Omit<
  TableOptions<TData>,
  'getCoreRowModel' | 'columnResizeMode' | 'columnResizeDirection'
> & {
  getCoreRowModel?: TableOptions<TData>['getCoreRowModel']
  columnResizeMode?: TableOptions<TData>['columnResizeMode']
  columnResizeDirection?: TableOptions<TData>['columnResizeDirection']
  /** Auto-inject a hidden validation_column when validation meta is provided. @default false */
  enableValidationColumn?: boolean
}

export function useDataGrid<TData extends Record<string, any>>(options: UseDataGridOptions<TData>) {
  const { enableValidationColumn, ...tableOptions } = options

  const validationErrors = tableOptions.meta?.validationErrors
  const validationWarnings = tableOptions.meta?.validationWarnings
  const validationKeyPrefix = tableOptions.meta?.validationKeyPrefix
  const hasValidation = enableValidationColumn

  const columns = useMemo(() => {
    const processed: ColumnDef<TData, any>[] = tableOptions.columns.map((col) => {
      if ((col as any).meta?.dataType && !col.filterFn) {
        return { ...col, filterFn }
      }
      return col
    })

    if (hasValidation) {
      processed.push({
        id: 'validation_column',
        header: '',
        filterFn: 'validationFilter' as any,
      })
    }

    return processed
  }, [tableOptions.columns, hasValidation])

  const filterFns = useMemo(() => {
    if (!hasValidation) return tableOptions.filterFns

    return {
      validationFilter: (row: Row<TData>, _columnId: string, filterValue: ValidationFilterValue[]) => {
        if (filterValue.length === 0) return true
        const errors = validationErrors ?? {}
        const warnings = validationWarnings ?? {}
        const prefix = validationKeyPrefix === 'rowId' ? `[${row.id}]` : `[${row.index}]`

        const rowHasError = Object.keys(errors).some((key) => key.startsWith(prefix))
        const rowHasWarning = Object.keys(warnings).some((key) => key.startsWith(prefix))
        const isSuccess = !rowHasError && !rowHasWarning

        return (
          (rowHasError && filterValue.includes('error')) ||
          (rowHasWarning && filterValue.includes('warning')) ||
          (isSuccess && filterValue.includes('success'))
        )
      },
      ...tableOptions.filterFns,
    } as typeof tableOptions.filterFns
  }, [hasValidation, validationErrors, validationWarnings, validationKeyPrefix, tableOptions.filterFns])

  const initialState = useMemo(() => {
    if (!hasValidation) return tableOptions.initialState
    return {
      ...tableOptions.initialState,
      columnVisibility: {
        validation_column: false,
        ...tableOptions.initialState?.columnVisibility,
      },
    }
  }, [hasValidation, tableOptions.initialState])

  const table = useReactTable({
    ...tableOptions,
    columns,
    filterFns,
    initialState,
    columnResizeMode: tableOptions.columnResizeMode ?? 'onChange',
    columnResizeDirection: tableOptions.columnResizeDirection ?? 'ltr',
    getCoreRowModel: tableOptions.getCoreRowModel ?? getCoreRowModel(),
    getFilteredRowModel: tableOptions.getFilteredRowModel ?? getFilteredRowModel(),
    getFacetedUniqueValues: tableOptions.getFacetedUniqueValues ?? getFacetedUniqueValues(),
    getSortedRowModel: tableOptions.getSortedRowModel ?? getSortedRowModel(),
  })

  return { table }
}
