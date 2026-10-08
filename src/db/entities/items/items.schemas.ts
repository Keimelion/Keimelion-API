import { z } from 'zod'
import { httpsUrlSchema } from '../../../shared/schemas/url.js'

export const MAX_ITEM_NAME_LENGTH = 300
export const MAX_ITEM_DESCRIPTION_LENGTH = 5000
export const MAX_ITEM_IMAGE_URL_LENGTH = 2048

export const itemNameSchema = z.string().trim().min(1).max(MAX_ITEM_NAME_LENGTH)

export const itemDescriptionSchema = z
  .string()
  .trim()
  .max(MAX_ITEM_DESCRIPTION_LENGTH)
  .nullable()
  .transform((value) => (value === '' ? null : value))

export const itemImageUrlSchema = httpsUrlSchema('imageUrl', MAX_ITEM_IMAGE_URL_LENGTH).nullable()
