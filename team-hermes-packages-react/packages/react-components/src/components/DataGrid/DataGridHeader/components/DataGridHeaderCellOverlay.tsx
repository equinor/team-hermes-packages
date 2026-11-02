/** biome-ignore-all lint/a11y/useSemanticElements: flex-table strategy */
import { Icon } from '@equinor/eds-core-react'
import { arrow_down, arrow_up } from '@equinor/eds-icons'
import { flexRender, type Header } from '@tanstack/react-table'
import { dataGridHeader } from '../DataGridHeader.styles'

type DataGridHeaderCellOverlayProps<TData extends Record<string, any>> = {
  header: Header<TData, unknown>
}

export const DataGridHeaderCellOverlay = <TData extends Record<string, any>>({
  header,
}: DataGridHeaderCellOverlayProps<TData>) => {
  const styles = dataGridHeader()
  const sortDirection =
    typeof header.column.getIsSorted === 'function' ? (header.column.getIsSorted() as string) : null
  const unit = header.column.columnDef.meta?.unit || ''

  return (
    <div
      role="cell"
      className={styles.headerCell()}
      style={{
        width: header.getSize(),
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        cursor: 'grabbing',
        opacity: 0.8,
      }}
    >
      <div className={styles.headerCellGrid()}>
        <button className={styles.headerCellClickArea()} disabled>
          <div className="truncate">
            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
            <span className="meta text-xs ml-2">{unit && unit !== 'unitless' && `(${unit})`}</span>
          </div>
          {sortDirection && <Icon data={sortDirection === 'desc' ? arrow_up : arrow_down} size={16} />}
        </button>
      </div>
    </div>
  )
}
