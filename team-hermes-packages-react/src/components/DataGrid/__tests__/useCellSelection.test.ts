import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Mock to break circular dependency: @/hooks → useFilters → @/common/components → DataGridCell → FilterDialog.utils → @/hooks
vi.mock('@/common/components/FilterDialog/FilterDialog.utils', () => ({}))

import { useCellSelection } from '../hooks/useCellSelection/useCellSelection'
import { createTestTable } from './testUtils'

function createSelectionHook(
  options: { validationErrors?: Record<string, string>; validationWarnings?: Record<string, string> } = {}
) {
  const table = createTestTable({
    validationErrors: options.validationErrors,
    validationWarnings: options.validationWarnings,
  })
  const rows = table.getRowModel().rows
  const scrollToRow = vi.fn()
  const scrollToColumn = vi.fn()
  const containerRef = { current: document.createElement('div') }

  const hook = renderHook(() =>
    useCellSelection({
      table,
      rows,
      scrollToRow,
      scrollToColumn,
      containerRef,
      validationErrors: options.validationErrors,
      validationWarnings: options.validationWarnings,
    })
  )

  return { hook, table, rows, scrollToRow, scrollToColumn }
}

describe('useCellSelection', () => {
  describe('cell selection', () => {
    it('should start with no cells selected', () => {
      const { hook } = createSelectionHook()
      expect(hook.result.current.selectedCells).toEqual([])
    })

    it('should select a single cell via setSelectedCells', () => {
      const { hook } = createSelectionHook()

      act(() => {
        hook.result.current.setSelectedCells([{ rowId: '0', columnId: 'name' }])
      })

      expect(hook.result.current.selectedCells).toEqual([{ rowId: '0', columnId: 'name' }])
    })

    it('should check if a cell is selected', () => {
      const { hook, rows } = createSelectionHook()

      act(() => {
        hook.result.current.setSelectedCells([{ rowId: '0', columnId: 'name' }])
      })

      const cell = rows[0].getVisibleCells().find((c) => c.column.id === 'name')
      const otherCell = rows[0].getVisibleCells().find((c) => c.column.id === 'depth')
      if (!cell || !otherCell) throw new Error('Expected cells not found')

      expect(hook.result.current.isCellSelected(cell)).toBe(true)
      expect(hook.result.current.isCellSelected(otherCell)).toBe(false)
    })

    it('should check if a row is selected', () => {
      const { hook } = createSelectionHook()

      act(() => {
        hook.result.current.setSelectedCells([{ rowId: '1', columnId: 'depth' }])
      })

      expect(hook.result.current.isRowSelected('1')).toBe(true)
      expect(hook.result.current.isRowSelected('0')).toBe(false)
    })

    it('should clear selection', () => {
      const { hook } = createSelectionHook()

      act(() => {
        hook.result.current.setSelectedCells([{ rowId: '0', columnId: 'name' }])
      })
      expect(hook.result.current.selectedCells).toHaveLength(1)

      act(() => {
        hook.result.current.clearSelection()
      })
      expect(hook.result.current.selectedCells).toEqual([])
    })

    it('should select all cells in a row', () => {
      const { hook } = createSelectionHook()

      act(() => {
        hook.result.current.setSelectedCellsByRow('1')
      })

      expect(hook.result.current.selectedCells).toEqual([
        { rowId: '1', columnId: 'name' },
        { rowId: '1', columnId: 'depth' },
        { rowId: '1', columnId: 'porosity' },
      ])
    })

    it('should select all cells in a column', () => {
      const { hook } = createSelectionHook()

      act(() => {
        hook.result.current.setSelectedCellsByColumn('depth')
      })

      const selected = hook.result.current.selectedCells
      expect(selected).toHaveLength(5)
      expect(selected.every((c) => c.columnId === 'depth')).toBe(true)
    })
  })

  describe('keyboard navigation', () => {
    it('should navigate down from a selected cell', () => {
      const { hook } = createSelectionHook()

      act(() => {
        hook.result.current.setSelectedCells([{ rowId: '0', columnId: 'name' }])
      })

      act(() => {
        hook.result.current.navigateRow('down', false)
      })

      expect(hook.result.current.selectedCells).toEqual([{ rowId: '1', columnId: 'name' }])
    })

    it('should navigate up from a selected cell', () => {
      const { hook } = createSelectionHook()

      act(() => {
        hook.result.current.setSelectedCells([{ rowId: '2', columnId: 'name' }])
      })

      act(() => {
        hook.result.current.navigateRow('up', false)
      })

      expect(hook.result.current.selectedCells).toEqual([{ rowId: '1', columnId: 'name' }])
    })

    it('should not navigate past the first row', () => {
      const { hook } = createSelectionHook()

      act(() => {
        hook.result.current.setSelectedCells([{ rowId: '0', columnId: 'name' }])
      })

      act(() => {
        hook.result.current.navigateRow('up', false)
      })

      expect(hook.result.current.selectedCells).toEqual([{ rowId: '0', columnId: 'name' }])
    })

    it('should not navigate past the last row', () => {
      const { hook } = createSelectionHook()

      act(() => {
        hook.result.current.setSelectedCells([{ rowId: '4', columnId: 'name' }])
      })

      act(() => {
        hook.result.current.navigateRow('down', false)
      })

      expect(hook.result.current.selectedCells).toEqual([{ rowId: '4', columnId: 'name' }])
    })

    it('should navigate left and right between columns', () => {
      const { hook } = createSelectionHook()

      act(() => {
        hook.result.current.setSelectedCells([{ rowId: '0', columnId: 'depth' }])
      })

      act(() => {
        hook.result.current.navigateCell('left')
      })
      expect(hook.result.current.selectedCells).toEqual([{ rowId: '0', columnId: 'name' }])

      act(() => {
        hook.result.current.navigateCell('right')
      })
      expect(hook.result.current.selectedCells).toEqual([{ rowId: '0', columnId: 'depth' }])
    })

    it('should navigate to first cell on Home', () => {
      const { hook } = createSelectionHook()

      act(() => {
        hook.result.current.setSelectedCells([{ rowId: '3', columnId: 'porosity' }])
      })

      act(() => {
        hook.result.current.navigateHome()
      })

      expect(hook.result.current.selectedCells).toEqual([{ rowId: '0', columnId: 'name' }])
    })

    it('should navigate to last cell on End', () => {
      const { hook } = createSelectionHook()

      act(() => {
        hook.result.current.setSelectedCells([{ rowId: '0', columnId: 'name' }])
      })

      act(() => {
        hook.result.current.navigateEnd()
      })

      expect(hook.result.current.selectedCells).toEqual([{ rowId: '4', columnId: 'porosity' }])
    })
  })

  describe('error/warning navigation', () => {
    const validationErrors: Record<string, string> = {
      '[0].depth': 'Depth out of range',
      '[2].porosity': 'Porosity too high',
      '[4].name': 'Name required',
    }

    it('should navigate to the first error on next', () => {
      const { hook, scrollToRow, scrollToColumn } = createSelectionHook({ validationErrors })

      act(() => {
        hook.result.current.selectErrorCell('next', 'error')
      })

      expect(hook.result.current.selectedCells).toEqual([{ rowId: '0', columnId: 'depth' }])
      expect(scrollToRow).toHaveBeenCalledWith(0, { behavior: 'instant', align: 'center' })
      expect(scrollToColumn).toHaveBeenCalledWith('depth')
    })

    it('should cycle through errors with next', () => {
      const { hook } = createSelectionHook({ validationErrors })

      act(() => {
        hook.result.current.selectErrorCell('next', 'error')
      })
      expect(hook.result.current.selectedCells).toEqual([{ rowId: '0', columnId: 'depth' }])

      act(() => {
        hook.result.current.selectErrorCell('next', 'error')
      })
      expect(hook.result.current.selectedCells).toEqual([{ rowId: '2', columnId: 'porosity' }])

      act(() => {
        hook.result.current.selectErrorCell('next', 'error')
      })
      expect(hook.result.current.selectedCells).toEqual([{ rowId: '4', columnId: 'name' }])
    })

    it('should wrap around when navigating past the last error', () => {
      const { hook } = createSelectionHook({ validationErrors })

      // Navigate to last error
      act(() => hook.result.current.selectErrorCell(2, 'error'))
      expect(hook.result.current.selectedCells).toEqual([{ rowId: '4', columnId: 'name' }])

      // Next should wrap to first
      act(() => hook.result.current.selectErrorCell('next', 'error'))
      expect(hook.result.current.selectedCells).toEqual([{ rowId: '0', columnId: 'depth' }])
    })

    it('should navigate backwards with previous', () => {
      const { hook } = createSelectionHook({ validationErrors })

      // Start at first error
      act(() => hook.result.current.selectErrorCell('next', 'error'))

      // Previous wraps to last
      act(() => hook.result.current.selectErrorCell('previous', 'error'))
      expect(hook.result.current.selectedCells).toEqual([{ rowId: '4', columnId: 'name' }])
    })

    it('should navigate warnings independently from errors', () => {
      const validationWarnings: Record<string, string> = {
        '[1].name': 'Name looks suspicious',
        '[3].depth': 'Depth unusually deep',
      }
      const { hook, scrollToColumn } = createSelectionHook({ validationErrors, validationWarnings })

      act(() => hook.result.current.selectErrorCell('next', 'warning'))
      expect(hook.result.current.selectedCells).toEqual([{ rowId: '1', columnId: 'name' }])
      expect(scrollToColumn).toHaveBeenCalledWith('name')

      act(() => hook.result.current.selectErrorCell('next', 'warning'))
      expect(hook.result.current.selectedCells).toEqual([{ rowId: '3', columnId: 'depth' }])
    })

    it('should report rowHasErrors correctly', () => {
      const { hook } = createSelectionHook({ validationErrors })

      expect(hook.result.current.rowHasErrors('0')).toBe(true)
      expect(hook.result.current.rowHasErrors('1')).toBe(false)
      expect(hook.result.current.rowHasErrors('2')).toBe(true)
    })

    it('should report rowHasWarnings correctly', () => {
      const validationWarnings = { '[1].name': 'Warning' }
      const { hook } = createSelectionHook({ validationWarnings })

      expect(hook.result.current.rowHasWarnings('0')).toBe(false)
      expect(hook.result.current.rowHasWarnings('1')).toBe(true)
    })
  })
})
