import type { Column } from '@tanstack/react-table'
import type { CSSProperties } from 'react'
import { AttributeType, FilterOperator } from '@/shared/types'
import { type ClientFilter, ColumnPinningDirection } from './DataGrid.types'

export const getCommonPinningStyles = <TData extends Record<string, any>>(column: Column<TData>): CSSProperties => {
  const isPinned = column.getIsPinned()
  const isLastLeftPinnedColumn =
    isPinned === ColumnPinningDirection.LEFT && column.getIsLastColumn(ColumnPinningDirection.LEFT)
  const isFirstRightPinnedColumn =
    isPinned === ColumnPinningDirection.RIGHT && column.getIsFirstColumn(ColumnPinningDirection.RIGHT)

  return {
    boxShadow: isLastLeftPinnedColumn
      ? '-4px 0 4px -4px gray inset'
      : isFirstRightPinnedColumn
        ? '4px 0 4px -4px gray inset'
        : undefined,
    left: isPinned === ColumnPinningDirection.LEFT ? `${column.getStart(ColumnPinningDirection.LEFT)}px` : undefined,
    right:
      isPinned === ColumnPinningDirection.RIGHT ? `${column.getAfter(ColumnPinningDirection.RIGHT)}px` : undefined,
    position: isPinned ? 'sticky' : 'relative',
    zIndex: isPinned ? 1 : 0,
  }
}

/**
 * filterFn is passed to the filterFn property of the column definition.
 * It is used to filter the data based on the filter value.
 * @param row
 * @param id
 * @param filter
 * @returns boolean
 */
export const filterFn = <TData extends Record<string, any>>(row: TData, id: string, filter: ClientFilter) => {
  const value = row.original[id]

  if (filter.value === undefined || filter.value === null || filter.value === '' || Number.isNaN(filter.value)) {
    return true
  }

  if (filter.dataType === AttributeType.BOOLEAN) {
    return true
  }

  // There are only two operators for text: ilike and eq
  // ilike is used for text search, eq is used for exact match (e.g., checkbox selection)
  if (filter.dataType === AttributeType.TEXT) {
    const stringValue = String(filter.value).toLowerCase()
    const stringRowValue = String(value).toLowerCase()
    switch (filter.operator) {
      case FilterOperator.ilike:
        return stringRowValue.includes(stringValue)
      case FilterOperator.eq:
        if (Array.isArray(filter.value)) {
          if (filter.value.length === 0) return true
          return (filter.value as string[]).includes(value)
        }
        return value === filter.value
      default:
        return true
    }
  }

  if (filter.dataType === AttributeType.NUMBER) {
    const numberValue = Number(filter.value)
    if (filter.value === undefined || filter.value === null) {
      return true
    }

    switch (filter.operator) {
      case FilterOperator.ilike:
        return String(value).includes(String(numberValue))
      case FilterOperator.eq:
        return value === numberValue
      case FilterOperator.neq:
        return value !== numberValue
      case FilterOperator.gt:
        return value > numberValue
      case FilterOperator.gte:
        return value >= numberValue
      case FilterOperator.lt:
        return value < numberValue
      case FilterOperator.lte:
        return value <= numberValue
      case FilterOperator.between: {
        const gt = Array.isArray(filter.value) && filter.value.length >= 1 ? filter.value[0] : null
        const lt = Array.isArray(filter.value) && filter.value.length >= 2 ? filter.value[1] : null

        if (!gt && !lt) return true
        if (gt && !lt) return Number(value) >= Number(gt)
        if (!gt && lt) return Number(value) <= Number(lt)
        return Number(gt) <= value && Number(lt) >= value
      }
      case FilterOperator.contains:
        return String(value).includes(String(numberValue))
    }
  }

  return true
}
