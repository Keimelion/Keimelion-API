import { z } from 'zod'
import { FILTER_OPERATORS } from './filter-config.js'
import type { FilterConfig } from './filter-config.js'
import type { FilterInput } from './filter-parser.js'

const filterOperatorSchema = z.enum(FILTER_OPERATORS)

export function buildFilterSchema<TEntity>(config: FilterConfig<TEntity>): z.ZodType<FilterInput[]> {
  const allowedFields = Object.keys(config) as (keyof TEntity & string)[]

  const filterInputSchema = z
    .object({
      field: z.string(),
      operator: z.string(),
      value: z.union([z.string(), z.array(z.string())]),
    })
    .superRefine((input, context) => {
      const fieldKey = input.field as keyof TEntity & string

      if (!allowedFields.includes(fieldKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field "${input.field}" is not allowed for filtering`,
          path: ['field'],
        })
        return
      }

      const parsedOperator = filterOperatorSchema.safeParse(input.operator)
      if (!parsedOperator.success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Operator "${input.operator}" is not a valid filter operator`,
          path: ['operator'],
        })
        return
      }

      const fieldConfig = config[fieldKey]
      if (!fieldConfig.operators.includes(parsedOperator.data)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Operator "${input.operator}" is not allowed for field "${input.field}"`,
          path: ['operator'],
        })
      }
    })

  return z.array(filterInputSchema)
}
