import { z } from 'zod'
import { shopSlugSchema } from '../shops/shops.schemas.js'
import { MAX_CATEGORY_NAME_LENGTH } from './categories.schema.js'

const MIN_NAME_LENGTH = 1

export const categoryNameSchema = z
  .string()
  .trim()
  .min(MIN_NAME_LENGTH)
  .max(MAX_CATEGORY_NAME_LENGTH)

export const categorySlugSchema = shopSlugSchema

export const categoryTranslationsCreateSchema = z
  .object({
    fr: categoryNameSchema,
    en: categoryNameSchema,
  })
  .strict()

export const categoryTranslationsUpdateSchema = z
  .object({
    fr: categoryNameSchema.optional(),
    en: categoryNameSchema.optional(),
  })
  .strict()
  .refine(
    (value) => value.fr !== undefined || value.en !== undefined,
    'At least one translation must be provided',
  )
