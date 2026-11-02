import type { FilterOperator } from './FilterOperator.type'

// biome-ignore lint/suspicious/noExplicitAny: The properties array can contain any type of values depending on the filter operator.
export type FilterValue = { operator: FilterOperator; properties: any[] }[]

export enum AttributeType {
  TEXT = 'text',
  NUMBER = 'number',
  BOOLEAN = 'bool',
  DATE_STRING = 'dateString',
  TEXT_ARRAY = 'textArray',
  NUMBER_ARRAY = 'numberArray',
}
