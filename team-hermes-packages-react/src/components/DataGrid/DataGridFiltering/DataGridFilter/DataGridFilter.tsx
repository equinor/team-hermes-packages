import { Icon } from '@equinor/eds-core-react'
import { filter_list, search } from '@equinor/eds-icons'
import type { Header } from '@tanstack/react-table'
import { FilterOperator, AttributeType } from '@/shared/types'
import { Combobox, type ComboboxItem, MenuCheckboxList, Popover, Stack, StyledTextField } from '@/components'
import type { ClientFilter } from '../../DataGrid.types'
import { dataGridFiltering } from '../DataGridFiltering.styles'

type DataGridFilterProps<TData extends Record<string, any>> = {
  header: Header<TData, unknown>
}

export function DataGridFilter<TData extends Record<string, any>>(props: DataGridFilterProps<TData>) {
  const { header } = props
  const styles = dataGridFiltering()
  const filter = header.column.getFilterValue() as ClientFilter | undefined
  const type = header.column.columnDef.meta?.dataType
  const uniqueValues = type === AttributeType.TEXT ? header.column.getFacetedUniqueValues() : []

  const numberFilters: ComboboxItem[] = [
    { value: FilterOperator.ilike, label: 'Contains' },
    { value: FilterOperator.eq, label: 'Equals' },
    { value: FilterOperator.neq, label: 'Not equals' },
    { value: FilterOperator.gt, label: 'Greater than' },
    { value: FilterOperator.gte, label: 'Greater than or equal to' },
    { value: FilterOperator.lt, label: 'Less than' },
    { value: FilterOperator.lte, label: 'Less than or equal to' },
    { value: FilterOperator.between, label: 'Between' },
  ]

  if (type === AttributeType.TEXT) {
    const filterOptions = Array.from(uniqueValues)?.map(([key, amount]) => ({
      label: key ? `${key} (${amount})` : `[Empty] (${amount})`,
      value: key,
    }))
    return (
      <MenuCheckboxList
        trigger={
          <button className={styles.filterButton()}>
            <Icon data={filter_list} size={24} />
          </button>
        }
        options={filterOptions}
        value={(filter?.value as string[]) ?? []}
        onChange={(newFilterValue) => {
          header.column.setFilterValue({
            operator: FilterOperator.eq,
            value: newFilterValue,
            dataType: AttributeType.TEXT,
          })
        }}
      />
    )
  }

  if (type === AttributeType.NUMBER) {
    return (
      <Popover
        trigger={
          <button
            className={styles.filterButton()}
            data-active={Array.isArray(filter?.value) ? filter.value.length > 0 : !!filter?.value}
          >
            <Icon data={filter_list} size={24} />
          </button>
        }
      >
        <Stack
          $padding={0.5}
          $spacing={0.5}
          $scrollY
          style={{
            maxHeight: '340px',
            maxWidth: '300px',
          }}
        >
          {type === AttributeType.NUMBER && (
            <>
              <Combobox
                items={numberFilters}
                value={numberFilters.find((f) => f.value === filter?.operator) || numberFilters[0]} // Default to the first option
                onChange={(selectedItem) => {
                  const prevFilter = header.column.getFilterValue() as ClientFilter | undefined
                  const value =
                    prevFilter?.operator === FilterOperator.between && Array.isArray(filter?.value)
                      ? filter.value[0]
                      : filter?.value
                  return header.column.setFilterValue(() => ({
                    operator: selectedItem?.value as FilterOperator,
                    value: value,
                    dataType: AttributeType.NUMBER,
                  }))
                }}
              />
              {filter?.operator !== FilterOperator.between && (
                <StyledTextField
                  value={filter?.value as number}
                  type="number"
                  inputIcon={<Icon data={search} />}
                  placeholder="Filter"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    header.column.setFilterValue(() => ({
                      operator: filter?.operator || numberFilters[0].value,
                      value: event.target.value,
                      dataType: AttributeType.NUMBER,
                    }))
                  }
                />
              )}
              {filter?.operator === FilterOperator.between && (
                <>
                  <StyledTextField
                    value={(filter?.value as number[])?.[0] || ''}
                    type="number"
                    inputIcon={<Icon data={search} />}
                    placeholder="Min"
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      header.column.setFilterValue(() => ({
                        operator: filter?.operator || numberFilters[0].value,
                        value: [event.target.value, (filter?.value as number[])?.[1]],
                        dataType: AttributeType.NUMBER,
                      }))
                    }
                  />
                  <StyledTextField
                    value={(filter?.value as number[])?.[1] || ''}
                    type="number"
                    inputIcon={<Icon data={search} />}
                    placeholder="Max"
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      header.column.setFilterValue(() => ({
                        operator: filter?.operator || numberFilters[0].value,
                        value: [(filter?.value as number[])?.[0], event.target.value],
                        dataType: AttributeType.NUMBER,
                      }))
                    }
                  />
                </>
              )}
            </>
          )}
        </Stack>
      </Popover>
    )
  }
  return null
}
