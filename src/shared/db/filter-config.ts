import type { AnyColumn } from 'drizzle-orm'

export const FILTER_OPERATORS = ['eq', 'in', 'gte', 'lte', 'between', 'ilike', 'isNull'] as const

export type FilterOperator = (typeof FILTER_OPERATORS)[number]

export interface FilterFieldConfig {
  column: AnyColumn
  operators: readonly [FilterOperator, ...FilterOperator[]]
}

export type FilterConfig<TEntity> = Readonly<Record<keyof TEntity & string, FilterFieldConfig>>
