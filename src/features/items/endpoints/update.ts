import { zValidator } from '@hono/zod-validator'
import { itemsUpdateRequestSchema } from '@keimelion/sdk/schemas'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { multipartOnly, RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { getLocale } from '../../../shared/middlewares/resolve-locale.js'
import {
  multipartBoolSchema,
  multipartJsonSchema,
  parseJsonOrMultipart,
  sendParseFailure,
} from '../../uploads/multipart.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { updateUserItem } from '../items.service.js'

const multipartUpdateItemSchema = itemsUpdateRequestSchema.extend({
  tags: multipartJsonSchema(itemsUpdateRequestSchema.shape.tags).optional(),
  categories: multipartJsonSchema(itemsUpdateRequestSchema.shape.categories).optional(),
  clearImage: multipartBoolSchema.optional(),
})

export function mountUpdateItem(router: FeatureRouter): void {
  router.patch(
    '/:id',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    multipartOnly(RATE_LIMITS.UPLOAD()),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    async (context) => {
      const parsed = await parseJsonOrMultipart(context, {
        jsonSchema: itemsUpdateRequestSchema,
        multipartSchema: multipartUpdateItemSchema,
      })
      if (!parsed.ok) return sendParseFailure(parsed)

      const user = getAuthUser(context)
      const { id } = context.req.valid('param')
      const locale = getLocale(context)
      const { clearImage, ...fields } = parsed.data
      const input = { ...fields, imageBuffer: parsed.imageBuffer, clearImage: clearImage ?? false }
      return jsonResult(context, await updateUserItem(id, user.id, input, locale))
    },
  )
}
