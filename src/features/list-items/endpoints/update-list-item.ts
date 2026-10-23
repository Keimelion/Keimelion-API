import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { listContributorMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult, sendError } from '../../../shared/utils/response.js'
import {
  creatorNoteSchema,
  quantityDesiredSchema,
} from '../../../db/entities/list-items/list-items.schemas.js'
import {
  multipartBoolSchema,
  parseJsonOrMultipart,
} from '../../uploads/multipart.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { findListItemById } from '../../../db/entities/list-items/list-items.repository.js'
import { updateListItemById } from '../list-items.service.js'

const jsonUpdateListItemSchema = z
  .object({
    quantityDesired: quantityDesiredSchema.optional(),
    creatorNote: creatorNoteSchema.optional(),
    sortOrder: z.number().int().optional(),
    clearImage: z.boolean().optional(),
  })
  .strict()

const multipartUpdateListItemSchema = z.object({
  quantityDesired: z.coerce.number().int().min(1).max(100).optional(),
  creatorNote: creatorNoteSchema.optional(),
  sortOrder: z.coerce.number().int().optional(),
  clearImage: multipartBoolSchema.optional(),
})

export function mountUpdateListItem(router: FeatureRouter): void {
  router.patch(
    '/:id',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    listContributorMiddleware({
      paramName: 'id',
      resolveListId: async (context) => {
        const listItemId = context.req.param('id')
        if (!listItemId) return null
        const listItem = await findListItemById(listItemId)
        return listItem?.listId ?? null
      },
    }),
    async (context) => {
      const { id } = context.req.valid('param')
      const parsed = await parseJsonOrMultipart(context, {
        jsonSchema: jsonUpdateListItemSchema,
        multipartSchema: multipartUpdateListItemSchema,
      })
      if (!parsed.ok) {
        return sendError(parsed.errorCode, parsed.issues ? { issues: parsed.issues } : {})
      }

      const user = getAuthUser(context)
      return jsonResult(
        context,
        await updateListItemById(
          id,
          {
            quantityDesired: parsed.data.quantityDesired,
            creatorNote: parsed.data.creatorNote,
            sortOrder: parsed.data.sortOrder,
            imageBuffer: parsed.imageBuffer,
            clearImage: parsed.data.clearImage ?? false,
          },
          user.id,
        ),
      )
    },
  )
}
