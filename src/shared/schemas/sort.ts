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
    .regex(/^[^:]+:[^:]+$/, 'sort must be in the format field:direction')
    .transform((value) => {
      const [field, direction] = value.split(':') as [string, string]
      return { field, direction }
    })
    .pipe(
      z.object({
        field: z.enum(allowedFields),
        direction: z.enum(SORT_DIRECTIONS),
      }),
    )
    .optional()
}
