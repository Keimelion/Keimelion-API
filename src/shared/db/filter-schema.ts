import { z } from 'zod'
import type { FilterConfig, FilterFieldConfig, FilterOperator } from './filter-config.js'
import type { FilterInput } from './filter-parser.js'

const defaultScalarSchema = z.string()
const booleanStringSchema = z.enum(['true', 'false'])

export function buildFilterSchema<TEntity>(config: FilterConfig<TEntity>): z.ZodType<FilterInput[]> {
  const entrySchemas = Object.entries(config).flatMap(([field, fieldConfig]) => {
    const cfg = fieldConfig as FilterFieldConfig
    return cfg.operators.map((operator) => buildEntrySchema(field, operator, cfg.valueSchema))
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

function buildEntrySchema(
  field: string,
  operator: FilterOperator,
  valueSchema: z.ZodType<string> | undefined,
): z.ZodType<FilterInput> {
  return z.object({
    field:    z.literal(field),
    operator: z.literal(operator),
    value:    resolveValueSchema(operator, valueSchema),
  }) as z.ZodType<FilterInput>
}

function resolveValueSchema(
  operator: FilterOperator,
  valueSchema: z.ZodType<string> | undefined,
): z.ZodType<string | string[]> {
  if (operator === 'isNull') return booleanStringSchema

  const scalar = valueSchema ?? defaultScalarSchema

  switch (operator) {
    case 'eq':
    case 'gte':
    case 'lte':
    case 'ilike':
      return scalar
    case 'in':
      return z.array(scalar).min(1)
    case 'between':
      return z.tuple([scalar, scalar])
  }
}
