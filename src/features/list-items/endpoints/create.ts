import { z } from 'zod'
import type { Context } from 'hono'
import { authMiddleware } from '../../../shared/middlewares/auth.js'
import { listContributorMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { ErrorCode } from '@keimelion/sdk/enums'
import { jsonResult, sendError } from '../../../shared/utils/response.js'
import {
  creatorNoteSchema,
  quantityDesiredSchema,
} from '../../../db/entities/list-items/list-items.schemas.js'
import type { AppVariables, FeatureRouter } from '../../../shared/types/app.js'
import { createListItem } from '../list-items.service.js'

type AppContext = Context<{ Variables: AppVariables }>

const createListItemSchema = z
  .object({
    listId: z.guid(),
    itemId: z.guid(),
    quantityDesired: quantityDesiredSchema.optional(),
    creatorNote: creatorNoteSchema.optional(),
  })
  .strict()

export function mountCreateListItem(router: FeatureRouter): void {
  router.post(
    '/',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    listContributorMiddleware({
      paramName: 'listId',
      resolveListId: resolveListIdFromJsonBody,
    }),
    async (context) => {
      const parsed = await parseCreateListItemBody(context)
      if ('errorCode' in parsed) {
        return sendError(parsed.errorCode, parsed.issues ? { issues: parsed.issues } : {})
      }

      return jsonResult(
        context,
        await createListItem({
          listId: parsed.data.listId,
          itemId: parsed.data.itemId,
          quantityDesired: parsed.data.quantityDesired ?? null,
          creatorNote: parsed.data.creatorNote ?? null,
        }),
      )
    },
  )
}

type ParsedCreateListItem = z.infer<typeof createListItemSchema>

interface CreateListItemParseSuccess {
  data: ParsedCreateListItem
}

interface CreateListItemParseError {
  errorCode: ErrorCode
  issues?: unknown
}

async function parseCreateListItemBody(
  context: AppContext,
): Promise<CreateListItemParseSuccess | CreateListItemParseError> {
  let body: unknown
  try {
    body = await context.req.raw.clone().json()
  } catch {
    return { errorCode: ErrorCode.BAD_REQUEST }
  }
  const result = createListItemSchema.safeParse(body)
  if (!result.success) {
    return {
      errorCode: ErrorCode.UNPROCESSABLE_ENTITY,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    }
  }
  return { data: result.data }
}

async function resolveListIdFromJsonBody(context: AppContext): Promise<string | null> {
  try {
    const body = (await context.req.raw.clone().json()) as { listId?: unknown }
    return typeof body.listId === 'string' ? body.listId : null
  } catch {
    return null
  }
}
