import {
  type CollisionDetection,
  closestCenter,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { Table } from '@tanstack/react-table'
import { type RefObject, useCallback, useState } from 'react'

const DRAG_CURSOR_STYLE_ID = 'dnd-drag-cursor'

function setDragCursor(cursor: string) {
  let style = document.getElementById(DRAG_CURSOR_STYLE_ID) as HTMLStyleElement | null
  if (!cursor) {
    style?.remove()
    return
  }
  if (!style) {
    style = document.createElement('style')
    style.id = DRAG_CURSOR_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = `* { cursor: ${cursor} !important; }`
}

export function useColumnDragDrop<TData extends Record<string, any>>(
  table: Table<TData>,
  headerRowRef: RefObject<HTMLDivElement | null>
) {
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Custom collision detection: only detect collisions when pointer is inside header row
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const headerEl = headerRowRef.current
      if (headerEl && args.pointerCoordinates) {
        const rect = headerEl.getBoundingClientRect()
        const { x, y } = args.pointerCoordinates
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
          return []
        }
      }
      return closestCenter(args)
    },
    [headerRowRef]
  )

  const tableColumnOrder = table.getState().columnOrder
  // Fall back to visible column IDs when columnOrder state is not configured on the table
  const columnOrder = tableColumnOrder.length > 0 ? tableColumnOrder : table.getVisibleLeafColumns().map((c) => c.id)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveColumnId(event.active.id as string)
    setDragCursor('grabbing')
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event
      if (!over) {
        setDragCursor('not-allowed')
        return
      }
      const overColumn = table.getColumn(over.id as string)
      if (overColumn?.getIsPinned()) {
        setDragCursor('not-allowed')
      } else {
        setDragCursor('grabbing')
      }
    },
    [table]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveColumnId(null)
      setDragCursor('')
      const { active, over } = event
      if (active && over && active.id !== over.id) {
        // Don't allow dropping onto a pinned column
        const overColumn = table.getColumn(over.id as string)
        if (overColumn?.getIsPinned()) return

        const oldIndex = columnOrder.indexOf(active.id as string)
        const newIndex = columnOrder.indexOf(over.id as string)
        if (oldIndex !== -1 && newIndex !== -1) {
          table.setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex))
        }
      }
    },
    [table, columnOrder]
  )

  const handleDragCancel = useCallback(() => {
    setActiveColumnId(null)
    setDragCursor('')
  }, [])

  // Only unpinned columns should be sortable/droppable targets
  const sortableColumnIds = columnOrder.filter((id) => {
    const col = table.getColumn(id)
    return col && !col.getIsPinned()
  })

  return {
    sensors,
    collisionDetection,
    activeColumnId,
    columnOrder,
    sortableColumnIds,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  }
}
