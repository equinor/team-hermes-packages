import type { ColumnDef } from '@tanstack/react-table'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { AttributeType } from '@/shared/types'
import { useDataGrid, type UseDataGridOptions } from '../useDataGrid'
import { type TestRow, testData } from './testUtils'

const baseColumns: ColumnDef<TestRow>[] = [
  { id: 'name', accessorKey: 'name', header: 'Name', meta: { dataType: AttributeType.TEXT } },
  { id: 'depth', accessorKey: 'depth', header: 'Depth', meta: { dataType: AttributeType.NUMBER } },
  { id: 'porosity', accessorKey: 'porosity', header: 'Porosity' },
]

function renderDataGrid(overrides: Partial<UseDataGridOptions<TestRow>> = {}) {
  return renderHook(() =>
    useDataGrid({
      data: testData,
      columns: baseColumns,
      getRowId: (row) => row.uid,
      ...overrides,
    })
  )
}

describe('useDataGrid', () => {
  it('returns a table instance', () => {
    const { result } = renderDataGrid()
    expect(result.current.table).toBeDefined()
    expect(result.current.table.getRowModel().rows).toHaveLength(testData.length)
  })

  it('auto-attaches filterFn to columns with meta.dataType', () => {
    const { result } = renderDataGrid()
    const cols = result.current.table.getAllColumns()

    expect(cols.find((c) => c.id === 'name')!.columnDef.filterFn).toBeDefined()
    expect(cols.find((c) => c.id === 'depth')!.columnDef.filterFn).toBeDefined()
  })

  it('does not override an existing filterFn', () => {
    const customFn = () => true
    const columns: ColumnDef<TestRow>[] = [
      { id: 'name', accessorKey: 'name', header: 'Name', meta: { dataType: AttributeType.TEXT }, filterFn: customFn },
    ]
    const { result } = renderDataGrid({ columns })

    expect(result.current.table.getAllColumns()[0].columnDef.filterFn).toBe(customFn)
  })

  it('does not attach custom filterFn to columns without meta.dataType', () => {
    const { result } = renderDataGrid()
    const nameCol = result.current.table.getAllColumns().find((c) => c.id === 'name')!
    const porosityCol = result.current.table.getAllColumns().find((c) => c.id === 'porosity')!

    expect(nameCol.columnDef.filterFn).not.toBe(porosityCol.columnDef.filterFn)
  })

  it('injects a hidden validation column when enableValidationColumn is true', () => {
    const { result } = renderDataGrid({
      enableValidationColumn: true,
      meta: { validationErrors: {} },
    })
    const cols = result.current.table.getAllColumns()
    const validationCol = cols.find((c) => c.id === 'validation_column')

    expect(validationCol).toBeDefined()
    expect(validationCol!.getIsVisible()).toBe(false)
  })

  it('does not inject validation column when enableValidationColumn is not set', () => {
    const { result } = renderDataGrid()
    const cols = result.current.table.getAllColumns()

    expect(cols.find((c) => c.id === 'validation_column')).toBeUndefined()
  })

  it('validation filter shows rows with errors when filtering for error', () => {
    const { result } = renderDataGrid({
      enableValidationColumn: true,
      meta: {
        validationErrors: { '[row-0].depth': 'too shallow' },
        validationKeyPrefix: 'rowId',
      },
    })
    const table = result.current.table
    const validationCol = table.getColumn('validation_column')!

    act(() => validationCol.setFilterValue(['error']))
    const filtered = result.current.table.getFilteredRowModel().rows
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('row-0')
  })

  it('validation filter shows all rows when filter value is empty', () => {
    const { result } = renderDataGrid({
      enableValidationColumn: true,
      meta: {
        validationErrors: { '[row-0].depth': 'too shallow' },
        validationKeyPrefix: 'rowId',
      },
    })
    const table = result.current.table
    const validationCol = table.getColumn('validation_column')!

    act(() => validationCol.setFilterValue([]))
    expect(result.current.table.getFilteredRowModel().rows).toHaveLength(testData.length)
  })

  it('defaults columnResizeMode to onChange', () => {
    const { result } = renderDataGrid()
    expect(result.current.table.options.columnResizeMode).toBe('onChange')
  })
})
