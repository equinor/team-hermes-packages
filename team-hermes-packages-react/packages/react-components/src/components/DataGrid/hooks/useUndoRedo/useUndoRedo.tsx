import type { Table } from '@tanstack/react-table'
import { useCallback, useEffect, useRef, useState } from 'react'
import { deepSet } from '@/shared/utils'
import type { CellChange } from '../../utils/cellUtils'

type HistoryEntry = {
  changes: CellChange[]
}

const MAX_HISTORY = 50

export type UndoRedo = ReturnType<typeof useUndoRedo>

export function useUndoRedo(table: Table<any>, containerRef: React.RefObject<HTMLElement | null>) {
  const pastRef = useRef<HistoryEntry[]>([])
  const futureRef = useRef<HistoryEntry[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const updateFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0)
    setCanRedo(futureRef.current.length > 0)
  }, [])

  const record = useCallback(
    (changes: CellChange[]) => {
      if (changes.length === 0) return
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), { changes }]
      futureRef.current = []
      updateFlags()
    },
    [updateFlags]
  )

  /**
   * @description Undoes the last change by applying the inverse of the most recent history entry.
   * Moves the undone entry to the future stack for potential redo.
   */
  const undo = useCallback(() => {
    const past = pastRef.current
    if (past.length === 0) return
    const entry = past[past.length - 1]
    const { setData, onCellsChanged } = table.options.meta ?? {}
    if (!setData) return

    pastRef.current = past.slice(0, -1)
    futureRef.current = [entry, ...futureRef.current]
    updateFlags()

    setData((prev: any) => {
      const newData = [...prev]
      for (const change of entry.changes) {
        deepSet(newData, `${change.rowIndex}.${change.accessorKey}`, change.oldValue)
      }
      return newData
    })

    onCellsChanged?.(entry.changes.map((c) => ({ rowIndex: c.rowIndex, columnId: c.columnId, value: c.oldValue })))
  }, [table, updateFlags])

  /**
   * @description Redoes the last undone change by reapplying the most recent future entry.
   * Moves the redone entry back to the past stack.
   * TODO: This implementation assumes that the redo operation will always succeed. In a more complex scenario,
   * we might want to add error handling in case the redo operation fails (e.g., due to conflicts with new changes).
   */
  const redo = useCallback(() => {
    const future = futureRef.current
    if (future.length === 0) return
    const entry = future[0]
    const { setData, onCellsChanged } = table.options.meta ?? {}
    if (!setData) return

    futureRef.current = future.slice(1)
    pastRef.current = [...pastRef.current, entry]
    updateFlags()

    setData((prev: any) => {
      const newData = [...prev]
      for (const change of entry.changes) {
        deepSet(newData, `${change.rowIndex}.${change.accessorKey}`, change.newValue)
      }
      return newData
    })

    onCellsChanged?.(entry.changes.map((c) => ({ rowIndex: c.rowIndex, columnId: c.columnId, value: c.newValue })))
  }, [table, updateFlags])

  /**
   * @description Clears the undo and redo history.
   */
  const clear = useCallback(() => {
    pastRef.current = []
    futureRef.current = []
    updateFlags()
  }, [updateFlags])

  // Document-level undo/redo listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const hasModifier = e.metaKey || e.ctrlKey
      if (!hasModifier) return

      if (e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if (e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [containerRef, undo, redo])

  return { record, undo, redo, clear, canUndo, canRedo }
}
