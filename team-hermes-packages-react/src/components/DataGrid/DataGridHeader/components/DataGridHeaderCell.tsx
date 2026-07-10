/** biome-ignore-all lint/a11y/useSemanticElements: flex table strategy */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@equinor/eds-core-react'
import { arrow_down, arrow_up } from '@equinor/eds-icons'
import { flexRender, type Header } from '@tanstack/react-table'
import type { CSSProperties } from 'react'
import { useDataGridContext } from '../../context/DataGridContext'
import { dataGridHeader } from '../DataGridHeader.styles'
import { DataGridHeaderCellMenu } from './DataGridHeaderCellMenu'

type DataGridHeaderCellProps<TData extends Record<string, any>> = {
  header: Header<TData, unknown>
}

export const DataGridHeaderCell = <TData extends Record<string, any>>({ header }: DataGridHeaderCellProps<TData>) => {
  const { table, cellActions } = useDataGridContext<TData>()
  const styles = dataGridHeader()

  const isPinned = header.column.getIsPinned()

  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: header.column.id,
    disabled: !!isPinned,
  })

  const dragStyle: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1 : 0,
  }
  const sortDirection =
    typeof header.column.getIsSorted === 'function' ? (header.column.getIsSorted() as string) : null

  const unit = header.column.columnDef.meta?.unit || ''

  return (
    <div
      className={styles.headerCell()}
      key={header.id}
      ref={setNodeRef}
      style={{
        width: `calc(var(--header-${header?.id}-size) * 1px)`,
        position: 'relative',
        ...dragStyle,
      }}
      data-testid="data-grid-header-cell"
      {...attributes}
    >
      <div className={styles.headerCellGrid()} {...listeners}>
        <button
          className={styles.headerCellClickArea()}
          disabled={!header.column.getCanSort()}
          onClick={header.column.getToggleSortingHandler()}
        >
          <div className="truncate">
            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
            <span className="meta text-xs ml-2">{unit && unit !== 'unitless' && `(${unit})`}</span>
          </div>
          {sortDirection && <Icon data={sortDirection === 'desc' ? arrow_down : arrow_up} size={16} />}
        </button>
        <DataGridHeaderCellMenu header={header} table={table} cellActions={cellActions} />
        <button
          aria-label="Resize column"
          className={styles.headerCellResizeHandle()}
          tabIndex={-1}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={() => header.column.resetSize()}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
        />
      </div>
    </div>
  )
}
