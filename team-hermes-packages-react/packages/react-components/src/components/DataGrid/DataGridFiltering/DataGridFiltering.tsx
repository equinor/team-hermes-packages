/** biome-ignore-all lint/a11y/useSemanticElements: using flex table strategy */
/** biome-ignore-all lint/a11y/useFocusableInteractive: using different focus strategy */
import type { Header, HeaderGroup } from '@tanstack/react-table'
import { useDataGridContext } from '../context/DataGridContext'
import { dataGridHeader } from '../DataGridHeader/DataGridHeader.styles'
import { DataGridSearchCell } from './DataGridSearchCell'
import { DataGridValidationHeaderCell } from './DataGridValidationHeaderCell'

type DataGridFilteringProps<TData extends Record<string, any>> = {
  headersByColumnId: Map<string, Header<TData, unknown>>
  headerGroup: HeaderGroup<TData>
}

export function DataGridFiltering<TData extends Record<string, any>>(props: DataGridFilteringProps<TData>) {
  const { headersByColumnId, headerGroup } = props
  const headerStyles = dataGridHeader()
  const { table, leftPinnedColumns, rightPinnedColumns, unpinnedColumns, enableRowSelection, filterable } =
    useDataGridContext<TData>()

  if (!filterable || table.options.manualFiltering) return null

  return (
    <div role="row" key={`${headerGroup.id}_search`} className="flex w-full">
      <div className="flex sticky left-0 z-4" data-shadow={leftPinnedColumns.length > 0 || undefined}>
        <DataGridValidationHeaderCell table={table} />
        {enableRowSelection && <div role="cell" className={headerStyles.headerCell()} style={{ width: 48 }} />}
        {leftPinnedColumns.map((col) => {
          const header = headersByColumnId.get(col.id)
          return header ? <DataGridSearchCell key={`${header.id}_search_cell`} header={header} /> : null
        })}
      </div>
      {unpinnedColumns.map((col) => {
        const header = headersByColumnId.get(col.id)
        return header ? <DataGridSearchCell key={`${header.id}_search_cell`} header={header} /> : null
      })}
      {rightPinnedColumns.length > 0 && (
        <div className="flex sticky right-0 z-4" data-shadow>
          {rightPinnedColumns.map((col) => {
            const header = headersByColumnId.get(col.id)
            return header ? <DataGridSearchCell key={`${header.id}_search_cell`} header={header} /> : null
          })}
        </div>
      )}
    </div>
  )
}
