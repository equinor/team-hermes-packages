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

  // Non API supported operators
  between = 'between',
}
