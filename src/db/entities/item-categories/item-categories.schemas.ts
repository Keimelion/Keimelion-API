import { z } from 'zod'

export const MAX_CATEGORIES_PER_ITEM = 2

export const itemCategoriesInputSchema = z
  .array(z.string().uuid())
  .max(
    MAX_CATEGORIES_PER_ITEM,
    `categories must contain at most ${String(MAX_CATEGORIES_PER_ITEM)} entries`,
  )
  .optional()
