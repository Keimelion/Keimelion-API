import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { LIST_STATUS_VALUES } from '../../../../shared/enums/list-status.js'
import {
  listTitleSchema,
  listDescriptionSchema,
  listOccasionTypeIdSchema,
} from '../../../../db/entities/lists/lists.schemas.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateListById } from '../admin-lists.service.js'

const adminUpdateListSchema = z
  .object({
    title: listTitleSchema.optional(),
    description: listDescriptionSchema.optional(),
    occasionTypeId: listOccasionTypeIdSchema.optional(),
    listStatus: z.enum(LIST_STATUS_VALUES).optional(),
  })
  .strict()

export type UpdateListInput = z.infer<typeof adminUpdateListSchema>

export function mountUpdateList(router: FeatureRouter): void {
  router.patch(
    '/:id',
    ...adminOnly,
    RATE_LIMITS.STANDARD(),
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', adminUpdateListSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateListById(admin.id, id, input))
    },
  )
}
