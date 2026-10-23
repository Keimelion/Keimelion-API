import { z } from 'zod'
import type { Context } from 'hono'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { listContributorMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { multipartOnly, RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult, sendError } from '../../../shared/utils/response.js'
import {
  creatorNoteSchema,
  quantityDesiredSchema,
} from '../../../db/entities/list-items/list-items.schemas.js'
import {
  isMultipartRequest,
  parseJsonOrMultipart,
  parseMultipartFields,
} from '../../uploads/multipart.js'
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
    multipartOnly(RATE_LIMITS.UPLOAD()),
    listContributorMiddleware({
      paramName: 'listId',
      resolveListId: resolveListIdFromRequest,
    }),
    async (context) => {
      const parsed = await parseJsonOrMultipart(context, {
        jsonSchema: jsonCreateListItemSchema,
        multipartSchema: multipartCreateListItemSchema,
      })
      if (!parsed.ok) {
        return sendError(parsed.errorCode, parsed.issues ? { issues: parsed.issues } : {})
      }

      const user = getAuthUser(context)
      return jsonResult(
        context,
        await createListItem(
          {
            listId: parsed.data.listId,
            itemId: parsed.data.itemId,
            quantityDesired: parsed.data.quantityDesired ?? null,
            creatorNote: parsed.data.creatorNote ?? null,
            imageBuffer: parsed.imageBuffer,
          },
          user.id,
        ),
      )
    },
  )
}

async function resolveListIdFromRequest(context: AppContext): Promise<string | null> {
  if (isMultipartRequest(context)) {
    const parsed = await parseMultipartFields(context)
    if ('errorCode' in parsed) return null
    return parsed.fields.listId ?? null
  }
  try {
    const body = (await context.req.raw.clone().json()) as { listId?: unknown }
    return typeof body.listId === 'string' ? body.listId : null
  } catch {
    return null
  }
}
