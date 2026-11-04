import { z } from 'zod'
import {
  itemDescriptionSchema,
  itemImageUrlSchema,
  itemNameSchema,
} from '../../db/entities/items/items.schemas.js'
import { itemTagsInputSchema } from '../../db/entities/item-tags/item-tags.schemas.js'
import { itemCategoriesInputSchema } from '../../db/entities/item-categories/item-categories.schemas.js'
import { multipartEmptyAsNullSchema, multipartJsonSchema } from '../uploads/multipart.js'

export const writableItemFieldsSchema = z.object({
  name: itemNameSchema,
  description: itemDescriptionSchema,
  imageUrl: itemImageUrlSchema,
  tags: itemTagsInputSchema,
  categories: itemCategoriesInputSchema,
})

export const multipartWritableItemFieldsSchema = z.object({
  name: itemNameSchema,
  description: itemDescriptionSchema,
  imageUrl: multipartEmptyAsNullSchema(itemImageUrlSchema),
  tags: multipartJsonSchema(itemTagsInputSchema),
  categories: multipartJsonSchema(itemCategoriesInputSchema),
})
