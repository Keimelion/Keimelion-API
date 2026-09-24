import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import { RATE_LIMITS } from '../../../../shared/utils/rate-limiter.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { LIST_STATUS_VALUES } from '../../../../shared/enums/list-status.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { updateListById } from '../admin-lists.service.js'

const MAX_TITLE_LENGTH = 200

const adminUpdateListSchema = z
  .object({
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
    description: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((value) => (value === '' ? null : value)),
    listStatus: z.enum(LIST_STATUS_VALUES).optional(),
    occasionTypeId: z.string().uuid().nullable().optional(),
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
