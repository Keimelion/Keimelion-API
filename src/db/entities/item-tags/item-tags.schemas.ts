import { z } from 'zod'
import { MAX_TAGS_PER_RESOURCE, tagNameSchema } from '../tags/tags.schemas.js'

export const itemTagsInputSchema = z
  .array(tagNameSchema)
  .max(
    MAX_TAGS_PER_RESOURCE,
    `tags must contain at most ${String(MAX_TAGS_PER_RESOURCE)} entries`,
  )
  .optional()
