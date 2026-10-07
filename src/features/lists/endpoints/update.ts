import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../../../shared/middlewares/auth.js'
import { listOwnershipMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { ListStatuses } from '../../../shared/enums/list-status.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { updateUserList } from '../lists.service.js'

const MAX_TITLE_LENGTH = 200

const USER_UPDATABLE_LIST_STATUSES = [ListStatuses.ACTIVE, ListStatuses.ARCHIVED] as const

const updateListSchema = z
  .object({
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
    description: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((value) => (value === '' ? null : value)),
    occasionTypeId: z.string().uuid().nullable().optional(),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    listStatus: z.enum(USER_UPDATABLE_LIST_STATUSES).optional(),
  })
  .strict()

export type UpdateListInput = z.infer<typeof updateListSchema>

export function mountUpdateUserList(router: FeatureRouter): void {
  router.patch(
    '/:id',
    authMiddleware,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', updateListSchema, validationErrorHandler),
    listOwnershipMiddleware({ paramName: 'id' }),
    async (context) => {
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateUserList(id, input))
    },
  )
}
