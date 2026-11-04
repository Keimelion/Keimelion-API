import { z } from 'zod'
import {
  itemDescriptionSchema,
  itemNameSchema,
} from '../../db/entities/items/items.schemas.js'
import { itemTagsInputSchema } from '../../db/entities/item-tags/item-tags.schemas.js'
import { itemCategoriesInputSchema } from '../../db/entities/item-categories/item-categories.schemas.js'
import { multipartJsonSchema } from '../uploads/multipart.js'

export const writableItemFieldsSchema = z.object({
  name: itemNameSchema,
  description: itemDescriptionSchema,
  tags: itemTagsInputSchema,
  categories: itemCategoriesInputSchema,
})

export const multipartWritableItemFieldsSchema = z.object({
  name: itemNameSchema,
  description: itemDescriptionSchema,
  tags: multipartJsonSchema(itemTagsInputSchema),
  categories: multipartJsonSchema(itemCategoriesInputSchema),
})
