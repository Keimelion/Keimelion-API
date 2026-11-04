import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { multipartOnly, RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { itemNameSchema, itemDescriptionSchema } from '../../../../db/entities/items/items.schemas.js'
import { itemCategoriesInputSchema } from '../../../../db/entities/item-categories/item-categories.schemas.js'
import { itemTagsInputSchema } from '../../../../db/entities/item-tags/item-tags.schemas.js'
import { getLocale } from '../../../../shared/middlewares/resolve-locale.js'
import {
  multipartBoolSchema,
  multipartJsonSchema,
  parseJsonOrMultipart,
  sendParseFailure,
} from '../../../uploads/multipart.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateItemById } from '../admin-items.service.js'

const jsonAdminUpdateItemSchema = z
  .object({
    name: itemNameSchema.optional(),
    description: itemDescriptionSchema.optional(),
    categories: itemCategoriesInputSchema,
    tags: itemTagsInputSchema,
    clearImage: z.boolean().optional(),
  })
  .strict()

const multipartAdminUpdateItemSchema = z
  .object({
    name: itemNameSchema.optional(),
    description: itemDescriptionSchema.optional(),
    categories: multipartJsonSchema(itemCategoriesInputSchema).optional(),
    tags: multipartJsonSchema(itemTagsInputSchema).optional(),
    clearImage: multipartBoolSchema.optional(),
  })
  .strict()

export type UpdateItemFields = Omit<z.infer<typeof jsonAdminUpdateItemSchema>, 'clearImage'>

export function mountUpdateItem(router: FeatureRouter): void {
  router.patch(
    '/:id',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    multipartOnly(RATE_LIMITS.UPLOAD()),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    async (context) => {
      const parsed = await parseJsonOrMultipart(context, {
        jsonSchema: jsonAdminUpdateItemSchema,
        multipartSchema: multipartAdminUpdateItemSchema,
      })
      if (!parsed.ok) return sendParseFailure(parsed)

      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const locale = getLocale(context)
      const { clearImage, ...fields } = parsed.data
      const input = { ...fields, imageBuffer: parsed.imageBuffer, clearImage: clearImage ?? false }
      return jsonResult(context, await updateItemById(admin.id, id, input, locale))
    },
  )
}
