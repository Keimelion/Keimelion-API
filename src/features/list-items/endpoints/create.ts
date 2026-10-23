import { z } from 'zod'
import type { Context } from 'hono'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { listContributorMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult, sendError } from '../../../shared/utils/response.js'
import { ErrorCode } from '../../../shared/enums/error-code.js'
import {
  creatorNoteSchema,
  quantityDesiredSchema,
} from '../../../db/entities/list-items/list-items.schemas.js'
import { isMultipartRequest, parseMultipart } from '../../uploads/multipart.js'
import type { AppVariables, FeatureRouter } from '../../../shared/types/app.js'
import { createListItem } from '../list-items.service.js'

type AppContext = Context<{ Variables: AppVariables }>

const jsonCreateListItemSchema = z
  .object({
    listId: z.string().uuid(),
    itemId: z.string().uuid(),
    quantityDesired: quantityDesiredSchema.optional(),
    creatorNote: creatorNoteSchema.optional(),
  })
  .strict()

const multipartCreateListItemSchema = z.object({
  listId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantityDesired: z.coerce.number().int().min(1).max(100).optional(),
  creatorNote: creatorNoteSchema.optional(),
})

export function mountCreateListItem(router: FeatureRouter): void {
  router.post(
    '/',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    listContributorMiddleware({
      paramName: 'listId',
      resolveListId: resolveListIdFromRequest,
    }),
    async (context) => {
      if (isMultipartRequest(context)) return handleMultipart(context)
      return handleJson(context)
    },
  )
}

async function resolveListIdFromRequest(context: AppContext): Promise<string | null> {
  if (isMultipartRequest(context)) {
    try {
      const body = (await context.req.parseBody()) as Record<string, unknown>
      const value = body.listId
      return typeof value === 'string' ? value : null
    } catch {
      return null
    }
  }
  try {
    const body = (await context.req.raw.clone().json()) as { listId?: unknown }
    return typeof body.listId === 'string' ? body.listId : null
  } catch {
    return null
  }
}

async function handleJson(context: AppContext): Promise<Response> {
  let payload: unknown
  try {
    payload = await context.req.json()
  } catch {
    return sendError(ErrorCode.BAD_REQUEST)
  }
  const result = jsonCreateListItemSchema.safeParse(payload)
  if (!result.success) {
    return sendError(ErrorCode.UNPROCESSABLE_ENTITY, { issues: result.error.issues })
  }

  const user = getAuthUser(context)
  return jsonResult(
    context,
    await createListItem(
      {
        listId: result.data.listId,
        itemId: result.data.itemId,
        quantityDesired: result.data.quantityDesired ?? null,
        creatorNote: result.data.creatorNote ?? null,
        imageBuffer: null,
      },
      user.id,
    ),
  )
}

async function handleMultipart(context: AppContext): Promise<Response> {
  const parsed = await parseMultipart(context, 'image')
  if ('errorCode' in parsed) return sendError(parsed.errorCode)

  const result = multipartCreateListItemSchema.safeParse(parsed.fields)
  if (!result.success) {
    return sendError(ErrorCode.UNPROCESSABLE_ENTITY, { issues: result.error.issues })
  }

  const user = getAuthUser(context)
  return jsonResult(
    context,
    await createListItem(
      {
        listId: result.data.listId,
        itemId: result.data.itemId,
        quantityDesired: result.data.quantityDesired ?? null,
        creatorNote: result.data.creatorNote ?? null,
        imageBuffer: parsed.imageBuffer,
      },
      user.id,
    ),
  )
}
