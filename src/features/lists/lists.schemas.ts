import { z } from 'zod'
import {
  listDescriptionSchema,
  listOccasionTypeIdSchema,
  listTitleSchema,
} from '../../db/entities/lists/lists.schemas.js'
import {
  MAX_TAGS_PER_RESOURCE,
  tagNameSchema,
} from '../../db/entities/tags/tags.schemas.js'

export const listTagsFieldSchema = z
  .array(tagNameSchema)
  .max(
    MAX_TAGS_PER_RESOURCE,
    `tags must contain at most ${String(MAX_TAGS_PER_RESOURCE)} entries`,
  )

export const writableListFieldsSchema = z.object({
  title: listTitleSchema,
  description: listDescriptionSchema,
  occasionTypeId: listOccasionTypeIdSchema,
  tags: listTagsFieldSchema,
})
