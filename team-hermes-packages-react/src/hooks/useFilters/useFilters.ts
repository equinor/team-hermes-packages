import type { ColumnDef, ColumnFiltersState } from '@tanstack/react-table'
import { AttributeType, type FilterValue } from '../../shared/types'

export const useFilters = () => {
  const createFiltersObjectFromURIString = (filterString: string | null): ColumnFiltersState => {
    if (!filterString || filterString === '') return []
    const filterList: ColumnFiltersState = []
    for (const filter of filterString.split(';')) {
      const filterValue = []
      const filterSplitIndex = filter.indexOf('*')
      const filterName = filter.substring(0, filterSplitIndex)
      const subFilters = filter.substring(filterSplitIndex + 1)
      for (const subFilter of subFilters.split('+')) {
        const [operator, properties] = subFilter.split('*')
        const propertyList = properties.split(',').map((val) => val.trim())
        filterValue.push({ operator, properties: propertyList })
      }
      filterList.push({ id: filterName, value: filterValue })
    }
    return filterList
  }

  const createURIStringFromFiltersObject = (filters: ColumnFiltersState): string => {
    const filterStrings = []
    for (const filter of filters) {
      const { id, value } = filter
      const filterId = `${String(id)}*`
      const subFilters = []
      if (!value || (value as string[])?.length === 0) continue
      for (const subFilter of value as FilterValue) {
        const { operator, properties } = subFilter
        const normalizedProperties = properties.map((val) => (val === null ? 'null' : String(val)))
        subFilters.push(`${operator}*${normalizedProperties.join(',')}`)
      }
      filterStrings.push(filterId + subFilters.join('+'))
    }
    return filterStrings.join(';')
  }

  const createRequestString = <TData extends Record<string, unknown>>(
    filters: ColumnFiltersState,
    columns: ColumnDef<TData>[]
  ): string | undefined => {
    const filterStrings = []
    if (filters.length === 0) return undefined
    for (const filter of filters) {
      const dataType = columns?.find((col) => col.id === filter.id)?.meta?.dataType
      for (const subFilters of filter.value as FilterValue) {
        const { operator, properties } = subFilters
        const combinedFilterStrings = []
        for (const val of properties) {
          const isNullValue = val === null || val === undefined || val === 'null'
          if (val === '' && !isNullValue) combinedFilterStrings.push(`${String(filter.id)} ${String(operator)}`)
          else
            combinedFilterStrings.push(
              `${String(filter.id)} ${String(operator)} ${dataType === AttributeType.TEXT && !isNullValue ? `'${String(val)}'` : String(val)}`
            )
        }
        filterStrings.push(`(${combinedFilterStrings.join(' or ')})`)
      }
    }
    return `(${filterStrings.join(' and ')})`
  }

  return {
    createFiltersObjectFromURIString,
    createURIStringFromFiltersObject,
    createRequestString,
  }
}
