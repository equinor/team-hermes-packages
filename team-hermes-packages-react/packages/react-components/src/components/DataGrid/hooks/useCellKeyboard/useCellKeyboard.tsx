import { useCallback } from 'react'
import type { CellClipboard } from '../useCellClipboard/useCellClipboard'
import type { CellEditing } from '../useCellEditing/useCellEditing'
import type { CellSelection } from '../useCellSelection/useCellSelection'

export type CellKeyboard = ReturnType<typeof useCellKeyboard>

export interface UseCellKeyboardProps {
  selection: CellSelection
  editing: CellEditing
  clipboard: CellClipboard
}

/**
 * @description handles all keyboard interactions with cells, including navigation, type-to-edit, and clipboard shortcuts.
 * Should be added as onKeyDown handler to the table body.
 * @returns
 */
export function useCellKeyboard({ selection, editing, clipboard }: UseCellKeyboardProps) {
  const handleCellsKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLElement>) => {
      // Already editing — let the input handle all keys
      if (editing.activeEditingCell) {
        if (e.key === 'Escape') {
          e.preventDefault()
          editing.cancelEditing()
        }
        return
      }

      const hasModifier = e.metaKey || e.ctrlKey

      // Modifier shortcuts
      if (hasModifier) {
        switch (e.key) {
          case 'c':
            await clipboard.copySelectedCells()
            return
          case 'v':
            e.preventDefault()
            await clipboard.pasteSelectedCells()
            return
          case 'e':
            e.preventDefault()
            editing.setCommentingCell()
            return
        }
      }

      switch (e.key) {
        case 'Backspace':
        case 'Delete': {
          if (editing.activeCommentingCell) return
          e.preventDefault()
          clipboard.deleteSelectedCells()
          break
        }
        case ' ': {
          if (editing.activeCommentingCell) return
          e.preventDefault()
          editing.setCurrentSelectedCellAsEditingCell()
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          selection.navigateRow('down', e.shiftKey)
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          selection.navigateRow('up', e.shiftKey)
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          selection.navigateCell('left')
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          selection.navigateCell('right')
          break
        }
        case 'Home': {
          e.preventDefault()
          selection.navigateHome()
          break
        }
        case 'End': {
          e.preventDefault()
          selection.navigateEnd()
          break
        }
        case 'Escape': {
          e.preventDefault()
          editing.cancelEditing()
          break
        }
        default: {
          // Type-to-edit: printable character clears cell and starts editing
          if (!editing.activeCommentingCell && !hasModifier && !e.altKey && e.key.length === 1) {
            e.preventDefault()
            editing.startEditingWithValue(e.key)
          }
          break
        }
      }
    },
    [selection, editing, clipboard]
  )

  return { handleCellsKeyDown }
}
