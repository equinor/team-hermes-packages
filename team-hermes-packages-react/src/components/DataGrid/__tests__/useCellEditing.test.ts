import type { Cell, RowData } from '@tanstack/react-table'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCellEditing } from '../hooks/useCellEditing/useCellEditing'
import { createTestTable } from './testUtils'

function findCell<T extends RowData>(cells: Cell<T, unknown>[], columnId: string) {
  const cell = cells.find((c) => c.column.id === columnId)
  if (!cell) throw new Error(`Cell with column '${columnId}' not found`)
  return cell
}

function createEditingHook(
  options: { editable?: boolean; selectedCells?: { rowId: string; columnId: string }[] } = {}
) {
  const { editable = true, selectedCells = [] } = options
  const table = createTestTable()
  const tableBodyRef = { current: document.createElement('tbody') as HTMLTableSectionElement }

  const hook = renderHook(
    (props) =>
      useCellEditing({
        table,
        tableBodyRef,
        selectedCells: props.selectedCells,
        editable: props.editable,
      }),
    { initialProps: { selectedCells, editable } }
  )

  return { hook, table }
}

describe('useCellEditing', () => {
  describe('editing state', () => {
    it('should start with no active editing cell', () => {
      const { hook } = createEditingHook()
      expect(hook.result.current.activeEditingCell).toBeNull()
    })

    it('should enter edit mode on double click', () => {
      const { hook, table } = createEditingHook()
      const cell = findCell(table.getRowModel().rows[0].getVisibleCells(), 'name')

      act(() => {
        hook.result.current.handleDoubleClick(cell)
      })

      expect(hook.result.current.activeEditingCell).toEqual({ rowId: '0', columnId: 'name' })
      expect(hook.result.current.editingCellValue).toBe('Sample A')
    })

    it('should not enter edit mode when editable is false', () => {
      const { hook, table } = createEditingHook({ editable: false })
      const cell = findCell(table.getRowModel().rows[0].getVisibleCells(), 'name')

      act(() => {
        hook.result.current.handleDoubleClick(cell)
      })

      expect(hook.result.current.activeEditingCell).toBeNull()
    })

    it('should check isCellEditing correctly', () => {
      const { hook, table } = createEditingHook()
      const cells = table.getRowModel().rows[0].getVisibleCells()
      const nameCell = findCell(cells, 'name')
      const depthCell = findCell(cells, 'depth')

      act(() => {
        hook.result.current.handleDoubleClick(nameCell)
      })

      expect(hook.result.current.isCellEditing(nameCell)).toBe(true)
      expect(hook.result.current.isCellEditing(depthCell)).toBe(false)
    })

    it('should cancel editing', () => {
      const { hook, table } = createEditingHook()
      const cell = findCell(table.getRowModel().rows[0].getVisibleCells(), 'name')

      act(() => hook.result.current.handleDoubleClick(cell))
      expect(hook.result.current.activeEditingCell).not.toBeNull()

      act(() => hook.result.current.cancelEditing())
      expect(hook.result.current.activeEditingCell).toBeNull()
    })

    it('should set editing cell from selected cells', () => {
      const { hook } = createEditingHook({
        selectedCells: [{ rowId: '1', columnId: 'depth' }],
      })

      act(() => {
        hook.result.current.setCurrentSelectedCellAsEditingCell()
      })

      expect(hook.result.current.activeEditingCell).toEqual({ rowId: '1', columnId: 'depth' })
      expect(hook.result.current.editingCellValue).toBe(200)
    })

    it('should not set editing cell when multiple cells are selected', () => {
      const { hook } = createEditingHook({
        selectedCells: [
          { rowId: '0', columnId: 'name' },
          { rowId: '1', columnId: 'name' },
        ],
      })

      act(() => {
        hook.result.current.setCurrentSelectedCellAsEditingCell()
      })

      expect(hook.result.current.activeEditingCell).toBeNull()
    })
  })

  describe('commenting state', () => {
    it('should start with no active commenting cell', () => {
      const { hook } = createEditingHook()
      expect(hook.result.current.activeCommentingCell).toBeNull()
    })

    it('should set commenting cell from selected cells', () => {
      const { hook } = createEditingHook({
        selectedCells: [{ rowId: '0', columnId: 'name' }],
      })

      act(() => {
        hook.result.current.setCommentingCell()
      })

      expect(hook.result.current.activeCommentingCell).toEqual({ rowId: '0', columnId: 'name' })
    })

    it('should check isCellCommenting correctly', () => {
      const { hook, table } = createEditingHook({
        selectedCells: [{ rowId: '0', columnId: 'name' }],
      })
      const cells = table.getRowModel().rows[0].getVisibleCells()
      const nameCell = findCell(cells, 'name')
      const depthCell = findCell(cells, 'depth')

      act(() => hook.result.current.setCommentingCell())

      expect(hook.result.current.isCellCommenting(nameCell)).toBe(true)
      expect(hook.result.current.isCellCommenting(depthCell)).toBe(false)
    })

    it('should clear commenting cell', () => {
      const { hook } = createEditingHook({
        selectedCells: [{ rowId: '0', columnId: 'name' }],
      })

      act(() => hook.result.current.setCommentingCell())
      expect(hook.result.current.activeCommentingCell).not.toBeNull()

      act(() => hook.result.current.setCommentingCell(true))
      expect(hook.result.current.activeCommentingCell).toBeNull()
    })

    it('should not set commenting cell when no cells are selected', () => {
      const { hook } = createEditingHook({ selectedCells: [] })

      act(() => hook.result.current.setCommentingCell())
      expect(hook.result.current.activeCommentingCell).toBeNull()
    })
  })
})
