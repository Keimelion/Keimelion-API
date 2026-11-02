import { z } from 'zod'
import { createSlugSchema } from '../../../shared/schemas/slug.js'
import { MAX_TAG_NAME_LENGTH, MAX_TAG_SLUG_LENGTH } from './tags.schema.js'

const MIN_TAG_NAME_LENGTH = 1
const MIN_TAG_SLUG_LENGTH = 1

export const MAX_TAGS_PER_RESOURCE = 20

export const tagNameSchema = z
  .string()
  .trim()
  .min(MIN_TAG_NAME_LENGTH)
  .max(MAX_TAG_NAME_LENGTH)

export const tagSlugSchema = createSlugSchema({
  min: MIN_TAG_SLUG_LENGTH,
  max: MAX_TAG_SLUG_LENGTH,
  example: 'gaming',
})

export const assignTagsBodySchema = z
  .object({
    names: z
      .array(tagNameSchema)
      .max(
        MAX_TAGS_PER_RESOURCE,
        `names must contain at most ${String(MAX_TAGS_PER_RESOURCE)} tags`,
      ),
  })
  .strict()
