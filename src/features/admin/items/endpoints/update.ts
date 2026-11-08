import { zValidator } from '@hono/zod-validator'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { multipartOnly, RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { adminItemsUpdateRequestSchema } from '@keimelion/sdk/schemas'
import { getLocale } from '../../../../shared/middlewares/resolve-locale.js'
import {
  multipartBoolSchema,
  multipartJsonSchema,
  parseJsonOrMultipart,
  sendParseFailure,
} from '../../../uploads/multipart.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateItemById } from '../admin-items.service.js'

const multipartAdminUpdateItemSchema = adminItemsUpdateRequestSchema.extend({
  categories: multipartJsonSchema(adminItemsUpdateRequestSchema.shape.categories).optional(),
  tags: multipartJsonSchema(adminItemsUpdateRequestSchema.shape.tags).optional(),
  clearImage: multipartBoolSchema.optional(),
})

export function mountUpdateItem(router: FeatureRouter): void {
  router.patch(
    '/:id',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    multipartOnly(RATE_LIMITS.UPLOAD()),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    async (context) => {
      const parsed = await parseJsonOrMultipart(context, {
        jsonSchema: adminItemsUpdateRequestSchema,
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
