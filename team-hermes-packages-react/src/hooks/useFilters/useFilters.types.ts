export type FilterValue = {
  operator: FilterOperator
  properties: (string | number | boolean | null)[]
}[]

export enum FilterOperator {
  eq = 'eq',
  neq = 'neq',
  like = 'like',
  ilike = 'ilike',
  notlike = 'notlike',
  notilike = 'notilike',
  gt = 'gt',
  lt = 'lt',
  gte = 'gte',
  lte = 'lte',
  inlist = 'inlist',
  notinlist = 'notinlist',
  isnull = 'isnull',
  notnull = 'notnull',
  contains = 'contains',
  notcontains = 'notcontains',
  between = 'between',
}
