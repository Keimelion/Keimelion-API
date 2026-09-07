import { z } from 'zod'

const SORT_DIRECTIONS = ['asc', 'desc'] as const

export type SortDirection = (typeof SORT_DIRECTIONS)[number]

export interface SortInput<TField extends string> {
  field: TField
  direction: SortDirection
}

export function sortQuerySchema<TField extends string>(
  allowedFields: readonly [TField, ...TField[]],
) {
  return z
    .string()
    .optional()
    .transform((value, context): SortInput<TField> | undefined => {
      if (value === undefined) return undefined

      const parts = value.split(':')
      if (parts.length !== 2) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'sort must be in the format field:direction' })
        return z.NEVER
      }

      const [field, direction] = parts as [string, string]

      if (!(allowedFields as readonly string[]).includes(field)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `sort field must be one of: ${allowedFields.join(', ')}` })
        return z.NEVER
      }

      if (!(SORT_DIRECTIONS as readonly string[]).includes(direction)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `sort direction must be one of: ${SORT_DIRECTIONS.join(', ')}` })
        return z.NEVER
      }

      return { field: field as TField, direction: direction as SortDirection }
    })
}
