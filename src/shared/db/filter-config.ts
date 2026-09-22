import type { AnyColumn } from 'drizzle-orm'
import type { z } from 'zod'

export const FILTER_OPERATORS = ['eq', 'in', 'gte', 'lte', 'between', 'ilike', 'isNull'] as const

export type FilterOperator = (typeof FILTER_OPERATORS)[number]

export type FilterValueType = 'string' | 'boolean' | 'number' | 'date'

export interface FilterFieldConfig {
  column: AnyColumn
  operators: readonly [FilterOperator, ...FilterOperator[]]
  valueType?: FilterValueType
  valueSchema?: z.ZodType<string>
}

export type FilterConfig<TEntity> = Readonly<Record<keyof TEntity & string, FilterFieldConfig>>
