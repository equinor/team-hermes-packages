import { describe, expect, it } from 'vitest'
import { AttributeType } from '@/shared/types'
import { getCellsInRange, getCellValuesAsText, isCellEditable, parseClipboardValue } from '../utils/cellUtils'
import { createTestTable } from './testUtils'

describe('cellUtils', () => {
  describe('getCellsInRange', () => {
    it('should return a rectangular range of cells', () => {
      const table = createTestTable()
      const rows = table.getRowModel().rows
      const columns = table.getVisibleLeafColumns()

      const result = getCellsInRange(
        rows,
        columns,
        { rowId: '0', columnId: 'name' },
        { rowId: '2', columnId: 'depth' }
      )

      expect(result).toEqual([
        { rowId: '0', columnId: 'name' },
        { rowId: '0', columnId: 'depth' },
        { rowId: '1', columnId: 'name' },
        { rowId: '1', columnId: 'depth' },
        { rowId: '2', columnId: 'name' },
        { rowId: '2', columnId: 'depth' },
      ])
    })

    it('should handle reversed start/end coordinates', () => {
      const table = createTestTable()
      const rows = table.getRowModel().rows
      const columns = table.getVisibleLeafColumns()

      const result = getCellsInRange(
        rows,
        columns,
        { rowId: '2', columnId: 'depth' },
        { rowId: '0', columnId: 'name' }
      )

      expect(result).toHaveLength(6)
      expect(result[0]).toEqual({ rowId: '0', columnId: 'name' })
    })

    it('should return a single cell when start equals end', () => {
      const table = createTestTable()
      const rows = table.getRowModel().rows
      const columns = table.getVisibleLeafColumns()

      const result = getCellsInRange(
        rows,
        columns,
        { rowId: '1', columnId: 'depth' },
        { rowId: '1', columnId: 'depth' }
      )

      expect(result).toEqual([{ rowId: '1', columnId: 'depth' }])
    })

    it('should return empty array for invalid coordinates', () => {
      const table = createTestTable()
      const rows = table.getRowModel().rows
      const columns = table.getVisibleLeafColumns()

      const result = getCellsInRange(
        rows,
        columns,
        { rowId: 'nonexistent', columnId: 'name' },
        { rowId: '0', columnId: 'name' }
      )

      expect(result).toEqual([])
    })
  })

  describe('getCellValuesAsText', () => {
    it('should return tab-separated values for a single row', () => {
      const table = createTestTable()
      const result = getCellValuesAsText(table, [
        { rowId: '0', columnId: 'name' },
        { rowId: '0', columnId: 'depth' },
      ])

      expect(result).toBe('Sample A\t100')
    })

    it('should return newline-separated rows', () => {
      const table = createTestTable()
      const result = getCellValuesAsText(table, [
        { rowId: '0', columnId: 'depth' },
        { rowId: '1', columnId: 'depth' },
      ])

      expect(result).toBe('100\n200')
    })
  })

  describe('parseClipboardValue', () => {
    it('should parse numeric strings for NUMBER type', () => {
      expect(parseClipboardValue('42.5', AttributeType.NUMBER)).toBe(42.5)
    })

    it('should handle comma as decimal separator for NUMBER type', () => {
      expect(parseClipboardValue('42,5', AttributeType.NUMBER)).toBe(42.5)
    })

    it('should return null for empty string on NUMBER type', () => {
      expect(parseClipboardValue('  ', AttributeType.NUMBER)).toBeNull()
    })

    it('should return null for empty string on TEXT type', () => {
      expect(parseClipboardValue('', AttributeType.TEXT)).toBeNull()
    })

    it('should return null for whitespace-only string on TEXT type', () => {
      expect(parseClipboardValue('  ', AttributeType.TEXT)).toBeNull()
    })

    it('should return raw string for TEXT type', () => {
      expect(parseClipboardValue('hello', AttributeType.TEXT)).toBe('hello')
    })
  })

  describe('isCellEditable', () => {
    it('should return false when editable is false', () => {
      const table = createTestTable()
      expect(isCellEditable(table, 'name', false)).toBe(false)
    })

    it('should return true for a standard column when editable', () => {
      const table = createTestTable()
      expect(isCellEditable(table, 'name', true)).toBe(true)
    })

    it('should return false for a nonexistent column', () => {
      const table = createTestTable()
      expect(isCellEditable(table, 'nonexistent', true)).toBe(false)
    })

    it('should return false when column meta editable is false', () => {
      const table = createTestTable({
        columns: [
          { accessorKey: 'name', header: 'Name', meta: { editable: false } },
          { accessorKey: 'depth', header: 'Depth' },
        ],
      })
      expect(isCellEditable(table, 'name', true)).toBe(false)
      expect(isCellEditable(table, 'depth', true)).toBe(true)
    })
  })
})
