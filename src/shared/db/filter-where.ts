import { and, between, eq, gte, ilike, inArray, isNotNull, isNull, lte, type AnyColumn, type SQL } from 'drizzle-orm'
import { escapeIlikePattern } from './filters.js'
import type { FilterConfig, FilterFieldConfig, FilterOperator, FilterValueType } from './filter-config.js'
import type { FilterInput } from './filter-parser.js'

type CoercedValue = string | boolean | number | Date

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

  const { column, valueType } = fieldConfig
  const operator = filter.operator as FilterOperator

  switch (operator) {
    case 'eq':
      return eq(column, coerceScalar(filter.value, valueType))
    case 'in':
      return inArray(column, coerceArray(filter.value, valueType))
    case 'gte':
      return gte(column, coerceScalar(filter.value, valueType))
    case 'lte':
      return lte(column, coerceScalar(filter.value, valueType))
    case 'between':
      return buildBetweenClause(column, filter.value, valueType)
    case 'ilike':
      return ilike(column, `%${escapeIlikePattern(toStringScalar(filter.value))}%`)
    case 'isNull':
      return filter.value === 'true' ? isNull(column) : isNotNull(column)
  }
}

function buildBetweenClause(column: AnyColumn, value: string | string[], valueType: FilterValueType | undefined): SQL {
  const parts = coerceArray(value, valueType)
  const [min, max] = parts as [CoercedValue, CoercedValue]
  return between(column, min, max)
}

function toStringScalar(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? '') : value
}

function coerceScalar(value: string | string[], valueType: FilterValueType | undefined): CoercedValue {
  return coerce(toStringScalar(value), valueType)
}

function coerceArray(value: string | string[], valueType: FilterValueType | undefined): CoercedValue[] {
  const items = Array.isArray(value) ? value : [value]
  return items.map((item) => coerce(item, valueType))
}

function coerce(raw: string, valueType: FilterValueType | undefined): CoercedValue {
  switch (valueType) {
    case 'boolean': return raw === 'true'
    case 'number':  return Number(raw)
    case 'date':    return new Date(raw)
    default:        return raw
  }
}
