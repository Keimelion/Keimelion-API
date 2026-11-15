import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  ADD_ITEM_TARGET_MESSAGE,
  listsAddItemByIdRequestSchema,
  listsAddItemRequestSchema,
  listsAddProductRequestSchema,
} from '@keimelion/sdk/schemas'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { listContributorMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { multipartOnly, RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { multipartJsonSchema, parseJsonOrMultipart, sendParseFailure } from '../../uploads/multipart.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { addItemToList } from '../add-item.service.js'

const { categories, quantityDesired, tags } = listsAddProductRequestSchema.shape

const multipartAddItemRequestSchema = z.union(
  [
    listsAddItemByIdRequestSchema.extend({
      quantityDesired: multipartJsonSchema(quantityDesired).optional(),
    }),
    listsAddProductRequestSchema.extend({
      quantityDesired: multipartJsonSchema(quantityDesired).optional(),
      tags: multipartJsonSchema(tags).optional(),
      categories: multipartJsonSchema(categories).optional(),
    }),
  ],
  { error: ADD_ITEM_TARGET_MESSAGE },
)

export function mountAddItem(router: FeatureRouter): void {
  router.post(
    '/:id/items',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    multipartOnly(RATE_LIMITS.UPLOAD()),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    listContributorMiddleware({ paramName: 'id' }),
    async (context) => {
      const parsed = await parseJsonOrMultipart(context, {
        jsonSchema: listsAddItemRequestSchema,
        multipartSchema: multipartAddItemRequestSchema,
      })
      if (!parsed.ok) return sendParseFailure(parsed)

      const user = getAuthUser(context)
      const { id } = context.req.valid('param')
      return jsonResult(
        context,
        await addItemToList({ listId: id, userId: user.id, request: parsed.data, imageBuffer: parsed.imageBuffer }),
      )
    },
  )
}
