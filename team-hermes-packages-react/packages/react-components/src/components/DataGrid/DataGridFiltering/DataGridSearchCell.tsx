import type { Header } from '@tanstack/react-table'
import type { ChangeEvent } from 'react'
import { FilterOperator, AttributeType } from '@/shared/types'
import { StyledTextField } from '@/components'
import type { ClientFilter } from '../DataGrid.types'
import { DataGridFilter } from './DataGridFilter/DataGridFilter'
import { dataGridFiltering } from './DataGridFiltering.styles'

type DataGridSearchCellProps<TData extends Record<string, any>> = {
  header: Header<TData, unknown>
  className?: string
}

export const DataGridSearchCell = <TData extends Record<string, any>>(props: DataGridSearchCellProps<TData>) => {
  const { header, className } = props
  const currentFilterValue = header.column.getFilterValue() as ClientFilter | undefined
  const { dataType } = header.column.columnDef.meta || {}
  const isFilterable =
    header.column.getCanFilter() && dataType !== AttributeType.TEXT_ARRAY && dataType !== AttributeType.NUMBER_ARRAY

  const styles = dataGridFiltering()

  const onSearchChange = (value: string) => {
    header.column.setFilterValue({
      // Force the operator to be 'ilike' for text searches
      operator:
        dataType !== AttributeType.TEXT ? currentFilterValue?.operator || FilterOperator.ilike : FilterOperator.ilike,
      value,
      dataType,
    })
  }

  return (
    <div
      className={styles.root({ className })}
      key={header.id}
      style={{
        width: `calc(var(--header-${header?.id}-size) * 1px)`,
        position: 'relative',
      }}
    >
      <StyledTextField
        type="search"
        value={
          currentFilterValue?.operator === FilterOperator.between
            ? `${(currentFilterValue?.value as number[])?.[0] || ''} - ${(currentFilterValue?.value as number[])?.[1] || ''}`
            : (currentFilterValue?.value as string)
        }
        onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchChange(event.target.value)}
        disabled={!isFilterable && currentFilterValue?.operator !== FilterOperator.between}
      />
      {isFilterable && <DataGridFilter header={header} />}
    </div>
  )
}
