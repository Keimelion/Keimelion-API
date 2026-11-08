import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { multipartOnly, RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { getLocale } from '../../../shared/middlewares/resolve-locale.js'
import { multipartJsonSchema, parseJsonOrMultipart, sendParseFailure } from '../../uploads/multipart.js'
import { itemsCreateRequestSchema } from '@keimelion/sdk/schemas'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { createUserItem } from '../items.service.js'

const multipartCreateItemSchema = itemsCreateRequestSchema.extend({
  tags: multipartJsonSchema(itemsCreateRequestSchema.shape.tags).optional(),
  categories: multipartJsonSchema(itemsCreateRequestSchema.shape.categories).optional(),
})

export function mountCreateItem(router: FeatureRouter): void {
  router.post(
    '/',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    multipartOnly(RATE_LIMITS.UPLOAD()),
    async (context) => {
      const parsed = await parseJsonOrMultipart(context, {
        jsonSchema: itemsCreateRequestSchema,
        multipartSchema: multipartCreateItemSchema,
      })
      if (!parsed.ok) return sendParseFailure(parsed)

      const user = getAuthUser(context)
      const locale = getLocale(context)
      const input = { ...parsed.data, imageBuffer: parsed.imageBuffer }
      return jsonResult(context, await createUserItem(user.id, input, locale))
    },
  )
}
