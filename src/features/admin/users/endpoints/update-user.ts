import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getAuthUser } from '../../../../shared/middlewares/auth.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { USER_ROLE_VALUES } from '../../../../shared/enums/user-role.js'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { updateUser } from '../admin-users.service.js'

const adminUpdateUserSchema = z.object({
  avatarUrl: z.string().url().nullable().optional(),
  isMarketingOptedIn: z.boolean().optional(),
  role: z.enum(USER_ROLE_VALUES).optional(),
})

export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>

export function mountUpdateUser(router: FeatureRouter): void {
  router.patch(
    '/:id',
    ...adminOnly,
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', adminUpdateUserSchema, validationErrorHandler),
    async (context) => {
      const admin = getAuthUser(context)
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      return jsonResult(context, await updateUser(admin.id, id, input))
    },
  )
}
