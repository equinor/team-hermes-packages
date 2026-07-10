/** biome-ignore-all lint/a11y/useSemanticElements: flex-table strategy */
/** biome-ignore-all lint/a11y/useFocusableInteractive: diff strategy */
import { Checkbox } from '@equinor/eds-core-react'
import type { Row, RowSelectionState } from '@tanstack/react-table'
import { useDataGridContext } from '../context/DataGridContext'
import { DataGridActionCell } from './components/DataGridActionCell/DataGridActionCell'
import { DataGridCell } from './components/DataGridCell'
import { dataGridBody } from './DataGridBody.styles'

export function DataGridBody<TData extends Record<string, any>>() {
  const {
    rowVirtualizer,
    table,
    rows,
    cellActions,
    tableBodyRef,
    virtualPaddingLeft,
    virtualPaddingRight,
    columnVirtualizer,
    leftPinnedColumns,
    rightPinnedColumns,
    unpinnedColumns,
    enableRowSelection,
  } = useDataGridContext<TData>()
  const dataGridBodyStyles = dataGridBody()
  const virtualColumns = columnVirtualizer.getVirtualItems()

  /**
   * Handle row selection change.
   * If shift key is pressed, select range of rows.
   * @param event - The change event
   * @param row - The row that was changed
   * @returns void
   */
  const handleRowSelectionChange = (event: React.ChangeEvent<HTMLInputElement>, row: Row<TData>) => {
    if ((event.nativeEvent as MouseEvent).shiftKey) {
      const rows = table.getFilteredRowModel().rows
      const previouslySelectedRowIndex = rows.findLastIndex((r) => r.getIsSelected())
      const currentRowIndex = rows.findIndex((r) => r.id === row.id)
      const start = Math.min(previouslySelectedRowIndex, currentRowIndex)
      const end = Math.max(previouslySelectedRowIndex, currentRowIndex)
      const newSelectedRows: RowSelectionState = {}
      for (let i = start; i <= end; i++) {
        newSelectedRows[rows[i].id] = true
      }
      table.setRowSelection({ ...table.getState().rowSelection, ...newSelectedRows })
      return
    }
    row.toggleSelected()
  }

  return (
    <div
      role="rowgroup"
      ref={tableBodyRef}
      style={{
        display: 'grid',
        height: `${rowVirtualizer.getTotalSize()}px`, //tells scrollbar how big the table is
        position: 'relative', //needed for absolute positioning of rows
      }}
      tabIndex={-1}
      onKeyDown={cellActions.handleCellsKeyDown}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const row = rows[virtualRow.index] as Row<TData>
        const visibleCells = row.getVisibleCells()
        const cellsByColumnId = new Map(visibleCells.map((cell) => [cell.column.id, cell]))
        return (
          <div
            className="flex absolute w-full"
            role="row"
            key={row.id}
            data-index={virtualRow.index}
            ref={(node) => rowVirtualizer.measureElement(node)}
            style={{
              transform: `translateY(${virtualRow.start}px)`, //this should always be a `style` as it changes on scroll
            }}
          >
            <div className="flex sticky left-0 z-4 bg-surface" data-shadow={leftPinnedColumns.length > 0 || undefined}>
              <DataGridActionCell
                hasError={cellActions.rowHasErrors(row.id)}
                hasWarning={cellActions.rowHasWarnings(row.id)}
                index={virtualRow.index}
                row={row}
              />
              {enableRowSelection && (
                <div
                  className={dataGridBodyStyles.cell({
                    className: 'justify-center! align-center min-h-[stretch] w-[48px]',
                  })}
                  role="cell"
                >
                  {
                    row.depth === 0 ? (
                      <Checkbox
                        checked={row.getIsSelected()}
                        onChange={(event) => handleRowSelectionChange(event, row)}
                      />
                    ) : (
                      '\u00A0'
                    ) /* non-breaking space to keep cell height */
                  }
                </div>
              )}
              {leftPinnedColumns.map((col) => {
                const cell = cellsByColumnId.get(col.id)
                return cell ? <DataGridCell key={cell.id} cell={cell} /> : null
              })}
            </div>
            {virtualPaddingLeft ? <div style={{ display: 'flex', width: virtualPaddingLeft }} /> : null}
            {virtualColumns.map((vc) => {
              const cell = cellsByColumnId.get(unpinnedColumns[vc.index].id)
              return cell ? <DataGridCell key={cell.id} cell={cell} /> : null
            })}
            {virtualPaddingRight ? <div style={{ display: 'flex', width: virtualPaddingRight }} /> : null}
            {rightPinnedColumns.length > 0 && (
              <div className="flex sticky right-0 z-4 bg-surface" data-shadow>
                {rightPinnedColumns.map((col) => {
                  const cell = cellsByColumnId.get(col.id)
                  return cell ? <DataGridCell key={cell.id} cell={cell} /> : null
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
