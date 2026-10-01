import { z } from 'zod'

const MIN_SORT_ORDER = 0
const MAX_SORT_ORDER = 32767

export const sortOrderSchema = z
  .number()
  .int('sortOrder must be an integer')
  .min(MIN_SORT_ORDER, `sortOrder must be at least ${String(MIN_SORT_ORDER)}`)
  .max(MAX_SORT_ORDER, `sortOrder must be at most ${String(MAX_SORT_ORDER)}`)
