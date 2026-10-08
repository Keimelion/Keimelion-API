import { z } from 'zod'

export const MAX_LIST_TITLE_LENGTH = 200

export const listTitleSchema = z.string().trim().min(1).max(MAX_LIST_TITLE_LENGTH)

export const listDescriptionSchema = z
  .string()
  .trim()
  .nullable()
  .transform((value) => (value === '' ? null : value))

export const listOccasionTypeIdSchema = z.string().uuid().nullable()
