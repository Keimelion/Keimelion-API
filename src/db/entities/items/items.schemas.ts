import { z } from 'zod'

export const MAX_ITEM_NAME_LENGTH = 300
export const MAX_ITEM_DESCRIPTION_LENGTH = 5000

export const itemNameSchema = z.string().trim().min(1).max(MAX_ITEM_NAME_LENGTH)

export const itemDescriptionSchema = z
  .string()
  .trim()
  .max(MAX_ITEM_DESCRIPTION_LENGTH)
  .nullable()
  .transform((value) => (value === '' ? null : value))
