import type { ColumnDef, ColumnFiltersState } from '@tanstack/react-table'
import { AttributeType, type FilterValue } from '../../shared/types'

// URI format: `id*op*prop1|prop2^op2*prop3~otherId*op*prop`.
// `~`, `|`, `^` are picked because they rarely appear in filter values (unlike `,` `;`).
// `+` is escaped even though it isn't a delimiter: `application/x-www-form-urlencoded` decoding
// turns a literal `+` in a query string into a space, which would otherwise break round-tripping.
const COLUMN_SEP = '~'
const OPERATOR_SEP = '^'
const PROPERTY_SEP = '|'
const FIELD_SEP = '*'

const RESERVED_CHARS = /[*~|^%+]/g
const RESERVED_ENC: Record<string, string> = {
  '*': '%2A',
  '~': '%7E',
  '|': '%7C',
  '^': '%5E',
  '%': '%25',
  '+': '%2B',
}
const encodePart = (s: string) => s.replace(RESERVED_CHARS, (c) => RESERVED_ENC[c])
const decodePart = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export const useFilters = () => {
  const createFiltersObjectFromURIString = (filterString: string | null): ColumnFiltersState => {
    if (!filterString) return []
    const filterList: ColumnFiltersState = []
    for (const filter of filterString.split(COLUMN_SEP)) {
      if (!filter) continue
      const filterSplitIndex = filter.indexOf(FIELD_SEP)
      if (filterSplitIndex <= 0) continue
      const filterName = decodePart(filter.substring(0, filterSplitIndex))
      const subFilters = filter.substring(filterSplitIndex + 1)
      const filterValue = []
      for (const subFilter of subFilters.split(OPERATOR_SEP)) {
        const subSplitIndex = subFilter.indexOf(FIELD_SEP)
        if (subSplitIndex <= 0) continue
        const operator = decodePart(subFilter.substring(0, subSplitIndex))
        const propertyList = subFilter
          .substring(subSplitIndex + 1)
          .split(PROPERTY_SEP)
          .map((val) => decodePart(val.trim()))
        filterValue.push({ operator, properties: propertyList })
      }
      if (filterValue.length > 0) filterList.push({ id: filterName, value: filterValue })
    }
    return filterList
  }

  const createURIStringFromFiltersObject = (filters: ColumnFiltersState): string => {
    const filterStrings = []
    for (const filter of filters) {
      const { id, value } = filter
      if (!value || (value as unknown[])?.length === 0) continue
      const subFilters = []
      for (const subFilter of value as FilterValue) {
        const { operator, properties } = subFilter
        const normalizedProperties = properties.map((val) => encodePart(val === null ? 'null' : String(val)))
        subFilters.push(`${encodePart(String(operator))}${FIELD_SEP}${normalizedProperties.join(PROPERTY_SEP)}`)
      }
      filterStrings.push(`${encodePart(String(id))}${FIELD_SEP}${subFilters.join(OPERATOR_SEP)}`)
    }
    return filterStrings.join(COLUMN_SEP)
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
