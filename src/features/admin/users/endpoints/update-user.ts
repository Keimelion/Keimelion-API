import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppVariables } from '../../../../shared/types/app.js'
import { uuidParamSchema } from '../../../../shared/schemas/params.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import { USER_ROLE_VALUES } from '../../../../shared/enums/user-role.js'
import { updateUser } from '../admin-users.service.js'

const adminUpdateUserSchema = z.object({
  avatarUrl: z.string().url().nullable().optional(),
  isMarketingOptedIn: z.boolean().optional(),
  role: z.enum(USER_ROLE_VALUES).optional(),
})

export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>

export function mountUpdateUser(router: Hono<{ Variables: AppVariables }>): void {
  router.patch(
    '/:id',
    zValidator('param', uuidParamSchema, validationErrorHandler),
    zValidator('json', adminUpdateUserSchema, validationErrorHandler),
    async (context) => {
      const admin = context.get('user')
      const { id } = context.req.valid('param')
      const input = context.req.valid('json')
      const { data, httpStatus } = await updateUser(admin.id, id, input)
      return context.json(data, httpStatus as 200)
    },
  )
}
