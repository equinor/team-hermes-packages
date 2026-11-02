import { Icon, Tooltip } from '@equinor/eds-core-react'
import { comment_chat, error_outlined, warning_outlined } from '@equinor/eds-icons'
import type { Cell } from '@tanstack/react-table'
import { memo, useId, useMemo, useRef, useState } from 'react'
import { useDataGridContext } from '../../context/DataGridContext'
import { AttributeType } from '@/shared/types'
import { dataGridBody } from '../DataGridBody.styles'
import { DataGridCellContent } from './DataGridCellContent/DataGridCellContent'
import { DataGridCellContextMenu } from './DataGridCellContextMenu/DataGridCellContextMenu'

type DataGridCellProps<TData extends Record<string, any>> = {
  cell: Cell<TData, unknown>
}

export type InputValue = string | number | string[] | number[]

export const DataGridCell = memo(<TData extends Record<string, any>>(props: DataGridCellProps<TData>) => {
  const { cell } = props
  const dataGridBodyStyles = dataGridBody()
  const { table, cellActions, editable, onArrayCellClick, commentConfig } = useDataGridContext<TData>()
  const cellRef = useRef<HTMLButtonElement>(null)
  const cellId = useId()
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false)
  const accessorKey = (cell.column.columnDef as any).accessorKey || cell.column.id
  const error = table.options?.meta?.validationErrors?.[`[${cell.row.index}].${accessorKey}`]
  const warning = table.options?.meta?.validationWarnings?.[`[${cell.row.index}].${accessorKey}`]

  const isCellSelected = cellActions.isCellSelected(cell)
  const isCellEditing = cellActions.isCellEditing(cell)
  const isCellCommenting = commentConfig?.enabled ? cellActions.isCellCommenting(cell) : false
  const { dataType, options = [] } = cell.column.columnDef.meta || {}

  const cellComments = useMemo(
    () => (commentConfig?.enabled ? commentConfig.getComments(cell.row.id, cell.column.id) : []),
    [commentConfig, cell.row.id, cell.column.id]
  )

  const commentPath = `${cell.row.id}.${cell.column.id}`

  const editCellData = () => {
    if (isCellEditing) return
    if (dataType === AttributeType.TEXT_ARRAY || dataType === AttributeType.NUMBER_ARRAY) {
      onArrayCellClick?.(cell.row.original, cell.getValue(), cell.column.id)
      return
    }
    if (!editable) return
    if (cell.column.columnDef.meta?.editable === false) return
    cellActions.handleDoubleClick(cell)
  }

  return (
    <div
      style={{
        width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
      }}
    >
      <button
        key={cell.id}
        ref={cellRef}
        id={cellId}
        data-testid="data-grid-cell"
        className={dataGridBodyStyles.cell({ className: dataType === AttributeType.NUMBER ? 'flex-row-reverse' : '' })}
        style={{
          width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
        }}
        tabIndex={-1}
        data-padded={!isCellEditing}
        data-selected={isCellSelected}
        data-error={!!error}
        data-warning={!!warning}
        onDoubleClick={editCellData}
        onContextMenu={(e) => {
          e.preventDefault()
          cellActions.handleCellMouseDown(e, cell)
          setIsContextMenuOpen(true)
        }}
        onMouseDown={(e) => cellActions.handleCellMouseDown(e, cell)}
        onMouseUp={() => cellActions.handleCellMouseUp()}
        onMouseOver={(e) => cellActions.handleCellMouseOver(e, cell)}
        onFocus={() => {}}
      >
        <DataGridCellContent options={options} isEditing={isCellEditing} dataType={dataType} cell={cell} />
        {!isCellEditing && (
          <div className="flex items-center justify-end gap-1">
            {!!error && (
              <Tooltip title={error}>
                <Icon data={error_outlined} color="var(--color-theme-danger-fg)" size={16} />
              </Tooltip>
            )}
            {!!warning && (
              <Tooltip title={warning}>
                <Icon data={warning_outlined} color="var(--color-theme-warning-fg)" size={16} />
              </Tooltip>
            )}
            {cellComments.length > 0 && (
              <Tooltip title={`${cellComments.length} comment${cellComments.length > 1 ? 's' : ''}`}>
                <Icon data={comment_chat} color="var(--color-theme-info-fg)" size={16} />
              </Tooltip>
            )}
          </div>
        )}
        {isContextMenuOpen && (
          <DataGridCellContextMenu
            cellId={cellId}
            isContextMenuOpen={isContextMenuOpen}
            setIsContextMenuOpen={setIsContextMenuOpen}
            cellRef={cellRef}
            cell={cell}
          />
        )}
        {isCellCommenting && commentConfig && (
          <commentConfig.CommentPopover
            anchorRef={cellRef}
            open={isCellCommenting}
            onClose={() => cellActions.setCommentingCell(true)}
            comments={cellComments}
            path={commentPath}
          />
        )}
      </button>
    </div>
  )
}) as <TData extends Record<string, any>>(props: DataGridCellProps<TData>) => React.ReactElement
