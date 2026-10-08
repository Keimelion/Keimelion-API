import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../../../shared/middlewares/auth.js'
import { getList, listOwnershipMiddleware } from '../../../shared/middlewares/list-access.middleware.js'
import { RATE_LIMITS } from '../../../shared/utils/rate-limiter.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { uuidParamSchema } from '../../../shared/schemas/params.js'
import { ListStatuses } from '../../../shared/enums/list-status.js'
import {
  listTitleSchema,
  listDescriptionSchema,
  listOccasionTypeIdSchema,
} from '../../../db/entities/lists/lists.schemas.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { updateUserList } from '../lists.service.js'

const USER_UPDATABLE_LIST_STATUSES = [ListStatuses.ACTIVE, ListStatuses.ARCHIVED] as const

const updateListSchema = z
  .object({
    title: listTitleSchema.optional(),
    description: listDescriptionSchema.optional(),
    occasionTypeId: listOccasionTypeIdSchema.optional(),
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
      const input = context.req.valid('json')
      return jsonResult(context, await updateUserList(getList(context), input))
    },
  )
}
