import { and, between, eq, gte, ilike, inArray, isNotNull, isNull, lte, type AnyColumn, type SQL } from 'drizzle-orm'
import { escapeIlikePattern } from './filters.js'
import type { FilterConfig, FilterFieldConfig, FilterOperator } from './filter-config.js'
import type { FilterInput } from './filter-parser.js'

export function buildGenericWhere<TEntity>(
  config: FilterConfig<TEntity>,
  filters: FilterInput[],
): SQL | undefined {
  const clauses = filters.map((filter) => buildClause(config, filter))
  return and(...clauses)
}

function buildClause<TEntity>(config: FilterConfig<TEntity>, filter: FilterInput): SQL {
  const fieldConfig = (config as Readonly<Record<string, FilterFieldConfig | undefined>>)[filter.field]

  if (fieldConfig === undefined) {
    throw new Error(`Filter field "${filter.field}" is not declared in FilterConfig`)
  }

  const { column } = fieldConfig
  const operator = filter.operator as FilterOperator

  switch (operator) {
    case 'eq':
      return eq(column, toScalar(filter.value))
    case 'in':
      return inArray(column, toStringArray(filter.value))
    case 'gte':
      return gte(column, toScalar(filter.value))
    case 'lte':
      return lte(column, toScalar(filter.value))
    case 'between':
      return buildBetweenClause(column, filter.value)
    case 'ilike':
      return ilike(column, `%${escapeIlikePattern(toScalar(filter.value))}%`)
    case 'isNull':
      return filter.value === 'true' ? isNull(column) : isNotNull(column)
  }
}

function buildBetweenClause(column: AnyColumn, value: string | string[]): SQL {
  const parts = toStringArray(value)
  const [min, max] = parts as [string, string]
  return between(column, min, max)
}

function toScalar(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? '') : value
}

function toStringArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value]
}
