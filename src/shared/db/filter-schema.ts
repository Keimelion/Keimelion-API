import { z } from 'zod'
import type { FilterConfig, FilterFieldConfig, FilterOperator, FilterValueType } from './filter-config.js'
import type { FilterInput } from './filter-parser.js'

const defaultScalarSchema = z.string()
const booleanStringSchema = z.enum(['true', 'false'])
const numericStringSchema = z.string().regex(/^-?\d+(?:\.\d+)?$/, 'must be a numeric string')
const isoDateStringSchema = z.string().datetime({ offset: true })

export function buildFilterSchema<TEntity>(config: FilterConfig<TEntity>): z.ZodType<FilterInput[]> {
  const entrySchemas = Object.entries(config).flatMap(([field, fieldConfig]) => {
    const cfg = fieldConfig as FilterFieldConfig
    const scalarSchema = cfg.valueSchema ?? defaultForValueType(cfg.valueType)
    return cfg.operators.map((operator) => buildEntrySchema(field, operator, scalarSchema))
  })

  const [first, second, ...rest] = entrySchemas

  if (first === undefined) {
    return z.array(z.never())
  }

  if (second === undefined) {
    return z.array(first)
  }

  return z.array(z.union([first, second, ...rest]))
}

function defaultForValueType(valueType: FilterValueType | undefined): z.ZodType<string> {
  switch (valueType) {
    case 'boolean': return booleanStringSchema
    case 'number':  return numericStringSchema
    case 'date':    return isoDateStringSchema
    case 'string':
    case undefined: return defaultScalarSchema
  }
}

function buildEntrySchema(
  field: string,
  operator: FilterOperator,
  scalarSchema: z.ZodType<string>,
): z.ZodType<FilterInput> {
  return z.object({
    field:    z.literal(field),
    operator: z.literal(operator),
    value:    resolveValueSchema(operator, scalarSchema),
  }) as z.ZodType<FilterInput>
}

function resolveValueSchema(
  operator: FilterOperator,
  scalarSchema: z.ZodType<string>,
): z.ZodType<string | string[]> {
  if (operator === 'isNull') return booleanStringSchema

  switch (operator) {
    case 'eq':
    case 'gte':
    case 'lte':
    case 'ilike':
      return scalarSchema
    case 'in':
      return z.array(scalarSchema).min(1)
    case 'between':
      return z.tuple([scalarSchema, scalarSchema])
  }
}
