import { Menu, Menubar } from '@base-ui/react'
import { Icon, Tooltip } from '@equinor/eds-core-react'
import { check, comment_add, copy, edit_text, keyboard_backspace, paste, redo, undo } from '@equinor/eds-icons'
import { useDataGridContext } from '../context/DataGridContext'
import { dataGridActionsBar } from './DataGridActionsBar.styles'
import { DataGridAddRow } from './DataGridAddRow/DataGridAddRow'
import { DataGridShortenDecimals } from './DataGridShortenDecimals/DataGridShortenDecimals'

const ICON_SIZE = 18

export function DataGridActionsBar<TData extends Record<string, any>>() {
  const { cellActions, table, containerRef, history, editable, enableAddRows, commentConfig } =
    useDataGridContext<TData>()
  const styles = dataGridActionsBar()

  const hasSelection = cellActions?.selectedCells?.length > 0
  const hasOneSelection = cellActions?.selectedCells?.length === 1
  const selectedCellColumnId = hasOneSelection ? cellActions.selectedCells[0]?.columnId : null
  const selectedCellColumn = selectedCellColumnId ? table.getColumn(selectedCellColumnId || '') : null
  const isSelectedCellEditable = selectedCellColumn ? selectedCellColumn.columnDef.meta?.editable !== false : false
  const isCellEditable = isSelectedCellEditable && editable

  return (
    <Menubar className="w-full flex left-0 bottom-0 sticky z-1 bg-surface border-t border-stroke-subtle">
      {enableAddRows && <DataGridAddRow />}
      {editable && (
        <DataGridShortenDecimals cellActions={cellActions} disabled={!hasSelection} containerRef={containerRef} />
      )}
      <Menu.Root>
        <Tooltip title={hasSelection ? 'Copy (Ctrl+C)' : 'Select cell(s) before copying'} placement="top">
          <Menu.Item
            className={styles.actionsBarMenuItem()}
            data-testid="data-grid-copy-button"
            onClick={() => cellActions.copySelectedCells()}
            disabled={!hasSelection}
          >
            <Icon data={cellActions.isCopied ? check : copy} size={ICON_SIZE} />
            {cellActions.isCopied && <span>Copied</span>}
          </Menu.Item>
        </Tooltip>
        <Tooltip title={hasSelection ? 'Paste (Ctrl+V)' : 'Select cell(s) before pasting'} placement="top">
          <Menu.Item
            className={styles.actionsBarMenuItem()}
            data-testid="data-grid-paste-button"
            onClick={() => cellActions.pasteSelectedCells()}
            disabled={!hasSelection || !isCellEditable}
            hidden={!editable}
          >
            <Icon data={paste} size={ICON_SIZE} />
          </Menu.Item>
        </Tooltip>
        <Tooltip title={hasSelection ? 'Clear (Backspace)' : 'Select cell(s) before clearing'} placement="top">
          <Menu.Item
            className={styles.actionsBarMenuItem()}
            data-testid="data-grid-clear-button"
            onClick={() => cellActions.deleteSelectedCells()}
            disabled={!hasSelection || !isCellEditable}
            hidden={!editable}
          >
            <Icon data={keyboard_backspace} size={ICON_SIZE} />
          </Menu.Item>
        </Tooltip>
        <Tooltip title={hasOneSelection ? 'Comment (Ctrl+E)' : 'Select cell(s) before commenting'} placement="top">
          <Menu.Item
            className={styles.actionsBarMenuItem()}
            data-testid="data-grid-comment-button"
            onClick={() => cellActions.setCommentingCell()}
            disabled={!hasOneSelection}
            hidden={!commentConfig?.enabled}
          >
            <Icon data={comment_add} size={ICON_SIZE} />
          </Menu.Item>
        </Tooltip>
        <Tooltip title={hasOneSelection ? 'Edit (Space)' : 'Select cell before editing'} placement="top">
          <Menu.Item
            className={styles.actionsBarMenuItem()}
            data-testid="data-grid-edit-button"
            onClick={() => cellActions.setCurrentSelectedCellAsEditingCell()}
            disabled={!hasOneSelection || !isCellEditable}
            hidden={!editable}
          >
            <Icon data={edit_text} size={ICON_SIZE} /> Edit
          </Menu.Item>
        </Tooltip>
        <Tooltip title={history.canUndo ? 'Undo (Ctrl+Z)' : 'Nothing to undo'} placement="top">
          <Menu.Item
            className={styles.actionsBarMenuItem()}
            data-testid="data-grid-undo-button"
            onClick={() => history.undo()}
            disabled={!history.canUndo}
            hidden={!editable}
          >
            <Icon data={undo} size={ICON_SIZE} />
          </Menu.Item>
        </Tooltip>
        <Tooltip title={history.canRedo ? 'Redo (Ctrl+Y)' : 'Nothing to redo'} placement="top">
          <Menu.Item
            className={styles.actionsBarMenuItem()}
            data-testid="data-grid-redo-button"
            onClick={() => history.redo()}
            disabled={!history.canRedo}
            hidden={!editable}
          >
            <Icon data={redo} size={ICON_SIZE} />
          </Menu.Item>
        </Tooltip>
      </Menu.Root>
    </Menubar>
  )
}
