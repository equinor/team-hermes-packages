/** biome-ignore-all lint/a11y/useSemanticElements: flex-table strategy */

import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { Checkbox } from '@equinor/eds-core-react'
import { useDataGridContext } from '../context/DataGridContext'
import type { LoadingStateConfig } from '../DataGrid.types'
import { DataGridFiltering } from '../DataGridFiltering/DataGridFiltering'
import { SkeletonColumns } from '../DataGridSkeleton/DataGridSkeleton'
import { DataGridActionHeaderCell } from './components/DataGridActionHeaderCell'
import { DataGridHeaderCell } from './components/DataGridHeaderCell'
import { dataGridHeader } from './DataGridHeader.styles'

type DataGridHeaderProps = {
  loadingStateConfig: LoadingStateConfig
  sortableColumnIds: string[]
}

export function DataGridHeader<TData extends Record<string, any>>(props: DataGridHeaderProps) {
  const { loadingStateConfig, sortableColumnIds } = props
  const headerStyles = dataGridHeader()

  const {
    table,
    headerRowRef,
    virtualPaddingLeft,
    virtualPaddingRight,
    virtualColumns,
    leftPinnedColumns,
    rightPinnedColumns,
    unpinnedColumns,
    enableRowSelection,
  } = useDataGridContext<TData>()

  return (
    <div role="rowgroup" ref={headerRowRef} style={{ position: 'sticky', top: 0, zIndex: 2, display: 'grid' }}>
      <SkeletonColumns
        condition={!!loadingStateConfig?.showSkeletonColumns}
        columnsAmount={loadingStateConfig?.skeletonColumnsAmount}
      >
        {table.getHeaderGroups().map((headerGroup) => {
          const headersByColumnId = new Map(headerGroup.headers.map((h) => [h.column.id, h]))
          return (
            <div key={headerGroup.id}>
              {/** biome-ignore lint/a11y/useFocusableInteractive: using different focus strategy */}
              <div role="row" style={{ display: 'flex', width: '100%' }}>
                <div className="flex sticky left-0 z-4" data-shadow={leftPinnedColumns.length > 0 || undefined}>
                  <DataGridActionHeaderCell table={table} />
                  {enableRowSelection && (
                    <div
                      role="cell"
                      className={headerStyles.headerCell({ className: 'flex items-center justify-center' })}
                      style={{ width: 48 }}
                    >
                      <Checkbox
                        checked={table.getIsAllRowsSelected()}
                        indeterminate={table.getIsSomeRowsSelected()}
                        onChange={table.getToggleAllRowsSelectedHandler()}
                      />
                    </div>
                  )}
                  {leftPinnedColumns.map((col) => {
                    const header = headersByColumnId.get(col.id)
                    return header ? <DataGridHeaderCell key={header.id} header={header} /> : null
                  })}
                </div>
                {virtualPaddingLeft ? (
                  // Fake empty column to the left for virtualization scroll padding
                  <div style={{ display: 'flex', width: virtualPaddingLeft }} />
                ) : null}
                <SortableContext items={sortableColumnIds} strategy={horizontalListSortingStrategy}>
                  {virtualColumns.map((vc) => {
                    const header = headersByColumnId.get(unpinnedColumns[vc.index].id)
                    return header ? <DataGridHeaderCell key={header.id} header={header} /> : null
                  })}
                </SortableContext>
                {virtualPaddingRight ? (
                  // Fake empty column to the right for virtualization scroll padding
                  <div style={{ display: 'flex', width: virtualPaddingRight }} />
                ) : null}
                {rightPinnedColumns.length > 0 && (
                  <div className="flex sticky right-0 z-4" data-shadow>
                    {rightPinnedColumns.map((col) => {
                      const header = headersByColumnId.get(col.id)
                      return header ? <DataGridHeaderCell key={header.id} header={header} /> : null
                    })}
                  </div>
                )}
              </div>
              <DataGridFiltering headersByColumnId={headersByColumnId} headerGroup={headerGroup} />
            </div>
          )
        })}
      </SkeletonColumns>
    </div>
  )
}
