/** biome-ignore-all lint/a11y/useSemanticElements: table needs nested divs */

import { DndContext, DragOverlay } from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { EdsProvider } from '@equinor/eds-core-react'
import { DataGridProvider, useDataGridContext } from './context/DataGridContext'
import type { DataGridProps } from './DataGrid.types'
import { DataGridActionsBar } from './DataGridActionsBar/DataGridActionsBar'
import { DataGridBody } from './DataGridBody/DataGridBody'
import { DataGridHeaderCellOverlay } from './DataGridHeader/components/DataGridHeaderCellOverlay'
import { DataGridHeader } from './DataGridHeader/DataGridHeader'
import { DataGridSidebar } from './DataGridSidebar/DataGridSidebar'
import { SkeletonRows } from './DataGridSkeleton/DataGridSkeleton'
import { useColumnDragDrop } from './hooks/useColumnDragDrop/useColumnDragDrop'

export const DataGrid = <TData extends Record<string, any>>(props: DataGridProps<TData>) => {
  const {
    table,
    loadingStateConfig = {},
    editable = false,
    enableAddRows = false,
    enableRemoveRows = false,
    filterable = true,
    enableRowSelection = false,
    deletionStrategy = 'remove',
    onArrayCellClick,
    commentConfig,
  } = props

  return (
    <EdsProvider density="compact">
      <DataGridProvider
        table={table}
        editable={editable}
        enableAddRows={enableAddRows}
        enableRemoveRows={enableRemoveRows}
        filterable={filterable}
        enableRowSelection={enableRowSelection}
        deletionStrategy={deletionStrategy}
        onArrayCellClick={onArrayCellClick}
        commentConfig={commentConfig}
      >
        <DataGridInner loadingStateConfig={loadingStateConfig} />
      </DataGridProvider>
    </EdsProvider>
  )
}

function DataGridInner({
  loadingStateConfig = {},
}: {
  loadingStateConfig?: DataGridProps<any>['loadingStateConfig']
}) {
  const { table, tableContainerRef, containerRef, headerRowRef, columnSizeVars } = useDataGridContext()

  const {
    sensors,
    collisionDetection,
    activeColumnId,
    sortableColumnIds,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useColumnDragDrop(table, headerRowRef)

  const activeHeader = activeColumnId ? table.getFlatHeaders().find((h) => h.column.id === activeColumnId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      modifiers={[restrictToHorizontalAxis]}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col h-full bg-surface" ref={containerRef} data-testid="data-grid">
        <div className="h-full flex min-h-0 grow border border-stroke-subtle">
          <div
            className="flex flex-col w-full overflow-auto relative grow min-h-0 whitespace-nowrap"
            ref={tableContainerRef}
          >
            <div
              role="table"
              className="grid grid-rows-[auto_1fr] grow border-collapse"
              style={{
                width: table.getTotalSize() || '100%',
                ...columnSizeVars,
              }}
            >
              <DataGridHeader loadingStateConfig={loadingStateConfig} sortableColumnIds={sortableColumnIds} />
              <SkeletonRows
                condition={!!loadingStateConfig?.showSkeletonRows}
                columnsAmount={loadingStateConfig?.skeletonColumnsAmount}
                rowsAmount={loadingStateConfig?.skeletonRowsAmount}
              >
                <DataGridBody />
              </SkeletonRows>
            </div>
            <DataGridActionsBar />
          </div>
          <DataGridSidebar />
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeHeader ? <DataGridHeaderCellOverlay header={activeHeader} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
