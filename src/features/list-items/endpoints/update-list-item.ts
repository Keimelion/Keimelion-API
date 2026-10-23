import { z } from 'zod'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { listContributorMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { jsonResult, sendError } from '../../../shared/utils/response.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import {
  creatorNoteSchema,
  quantityDesiredSchema,
} from '../../../db/entities/list-items/list-items.schemas.js'
import { isMultipartRequest, parseBooleanField, parseMultipart } from '../../uploads/multipart.js'
import type { AppVariables, FeatureRouter } from '../../../shared/types/app.js'
import { findListItemById } from '../../../db/entities/list-items/list-items.repository.js'
import { updateListItemById } from '../list-items.service.js'

type AppContext = Context<{ Variables: AppVariables }>

const jsonUpdateListItemSchema = z
  .object({
    quantityDesired: quantityDesiredSchema.optional(),
    creatorNote: creatorNoteSchema.optional(),
    sortOrder: z.number().int().optional(),
    clearImage: z.boolean().optional(),
  })
  .strict()

const multipartUpdateFieldsSchema = z.object({
  quantityDesired: z.coerce.number().int().min(1).max(100).optional(),
  creatorNote: creatorNoteSchema.optional(),
  sortOrder: z.coerce.number().int().optional(),
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
      if (isMultipartRequest(context)) return handleMultipart(context, id)
      return handleJson(context, id)
    },
  )
}

async function handleJson(context: AppContext, listItemId: string): Promise<Response> {
  let payload: unknown
  try {
    payload = await context.req.json()
  } catch {
    return sendError(ErrorCode.BAD_REQUEST)
  }
  const result = jsonUpdateListItemSchema.safeParse(payload)
  if (!result.success) {
    return sendError(ErrorCode.UNPROCESSABLE_ENTITY, { issues: result.error.issues })
  }

  const user = getAuthUser(context)
  return jsonResult(
    context,
    await updateListItemById(
      listItemId,
      {
        quantityDesired: result.data.quantityDesired,
        creatorNote: result.data.creatorNote,
        sortOrder: result.data.sortOrder,
        imageBuffer: null,
        clearImage: result.data.clearImage ?? false,
      },
      user.id,
    ),
  )
}

async function handleMultipart(context: AppContext, listItemId: string): Promise<Response> {
  const parsed = await parseMultipart(context, 'image')
  if ('errorCode' in parsed) return sendError(parsed.errorCode)

  const result = multipartUpdateFieldsSchema.safeParse(parsed.fields)
  if (!result.success) {
    return sendError(ErrorCode.UNPROCESSABLE_ENTITY, { issues: result.error.issues })
  }

  const user = getAuthUser(context)
  const clearImage = parseBooleanField(parsed.fields.clear_image)
  return jsonResult(
    context,
    await updateListItemById(
      listItemId,
      {
        quantityDesired: result.data.quantityDesired,
        creatorNote: result.data.creatorNote,
        sortOrder: result.data.sortOrder,
        imageBuffer: parsed.imageBuffer,
        clearImage,
      },
      user.id,
    ),
  )
}
