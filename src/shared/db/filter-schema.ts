import { z } from 'zod'
import type { FilterConfig, FilterFieldConfig, FilterOperator } from './filter-config.js'
import type { FilterInput } from './filter-parser.js'

const scalarValueSchema = z.string()
const booleanStringValueSchema = z.enum(['true', 'false'])
const arrayValueSchema = z.array(z.string()).min(1)
const tupleValueSchema = z.tuple([z.string(), z.string()])

const valueSchemaByOperator: Record<FilterOperator, z.ZodType<string | string[]>> = {
  eq:      scalarValueSchema,
  gte:     scalarValueSchema,
  lte:     scalarValueSchema,
  ilike:   scalarValueSchema,
  isNull:  booleanStringValueSchema,
  in:      arrayValueSchema,
  between: tupleValueSchema,
}

export function buildFilterSchema<TEntity>(config: FilterConfig<TEntity>): z.ZodType<FilterInput[]> {
  const entrySchemas = Object.entries(config).flatMap(([field, fieldConfig]) =>
    (fieldConfig as FilterFieldConfig).operators.map((operator) => buildEntrySchema(field, operator)),
  )

  const [first, second, ...rest] = entrySchemas

  if (first === undefined) {
    return z.array(z.never())
  }

  if (second === undefined) {
    return z.array(first)
  }

  return z.array(z.union([first, second, ...rest]))
}

function buildEntrySchema(field: string, operator: FilterOperator): z.ZodType<FilterInput> {
  return z.object({
    field:    z.literal(field),
    operator: z.literal(operator),
    value:    valueSchemaByOperator[operator],
  }) as z.ZodType<FilterInput>
}
