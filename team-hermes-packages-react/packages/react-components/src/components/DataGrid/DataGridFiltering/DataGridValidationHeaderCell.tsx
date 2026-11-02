/** biome-ignore-all lint/a11y/useSemanticElements: flex table strategy */
import { Icon } from '@equinor/eds-core-react'
import { filter_list } from '@equinor/eds-icons'
import type { Table } from '@tanstack/react-table'
import { MenuCheckboxList } from '@/components'
import { useDataGridContext } from '../context/DataGridContext'
import { dataGridHeader } from '../DataGridHeader/DataGridHeader.styles'
import { dataGridFiltering } from './DataGridFiltering.styles'

export const DataGridValidationHeaderCell = ({ table }: { table: Table<any> }) => {
  const { editable } = useDataGridContext()
  const validationColumn = editable ? table.getColumn('validation_column') : undefined
  const currentFilterValue = (validationColumn?.getFilterValue() as string[] | undefined) || []
  const headerStyles = dataGridHeader()
  const styles = dataGridFiltering()

  return (
    <div
      role="cell"
      className={headerStyles.headerCell({ className: 'flex justify-end items-center pr-2.5' })}
      style={{
        width: validationColumn ? 96 : 48,
      }}
    >
      {validationColumn && (
        <MenuCheckboxList
          trigger={
            <button className={styles.filterButton()}>
              <Icon data={filter_list} size={24} />
            </button>
          }
          options={[
            { label: 'Success', value: 'success' },
            { label: 'Warning', value: 'warning' },
            { label: 'Error', value: 'error' },
          ]}
          value={currentFilterValue}
          onChange={(newValue) => validationColumn?.setFilterValue(newValue)}
        />
      )}
    </div>
  )
}
