import { z } from 'zod'
import {
  itemDescriptionSchema,
  itemImageUrlSchema,
  itemNameSchema,
} from '../../db/entities/items/items.schemas.js'
import {
  MAX_TAGS_PER_RESOURCE,
  tagNameSchema,
} from '../../db/entities/tags/tags.schemas.js'
import { itemCategoriesInputSchema } from '../../db/entities/item-categories/item-categories.schemas.js'

export const itemTagsFieldSchema = z
  .array(tagNameSchema)
  .max(
    MAX_TAGS_PER_RESOURCE,
    `tags must contain at most ${String(MAX_TAGS_PER_RESOURCE)} entries`,
  )

export const writableItemFieldsSchema = z.object({
  name: itemNameSchema,
  description: itemDescriptionSchema,
  imageUrl: itemImageUrlSchema,
  tags: itemTagsFieldSchema,
  categories: itemCategoriesInputSchema,
})
