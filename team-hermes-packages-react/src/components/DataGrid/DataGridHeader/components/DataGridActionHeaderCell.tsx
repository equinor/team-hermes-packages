/** biome-ignore-all lint/a11y/useSemanticElements: different table strategy */
import type { Table } from '@tanstack/react-table'
import { useDataGridContext } from '../../context/DataGridContext'
import { dataGridHeader } from '../DataGridHeader.styles'

export const DataGridActionHeaderCell = ({ table }: { table: Table<any> }) => {
  const { editable } = useDataGridContext()
  const validationColumn = editable ? table.getColumn('validation_column') : null
  const styles = dataGridHeader()

  return (
    <div
      role="cell"
      className={styles.headerCell()}
      style={{
        width: validationColumn ? 96 : 48,
      }}
    />
  )
}
