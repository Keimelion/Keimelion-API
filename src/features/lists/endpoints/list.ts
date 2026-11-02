import { zValidator } from '@hono/zod-validator'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { jsonResult } from '../../../shared/utils/response.js'
import { paginationQuerySchema } from '../../../shared/schemas/pagination.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import type { z } from 'zod'
import { listUserLists } from '../lists.service.js'
import { userListsEntity } from '../lists.repository.js'

const listUserListsQuerySchema = paginationQuerySchema.extend({
  sort: userListsEntity.buildListQuerySchema(),
})

export type ListUserListsInput = z.infer<typeof listUserListsQuerySchema>

export function mountListUserLists(router: FeatureRouter): void {
  router.get(
    '/',
    authMiddleware,
    zValidator('query', listUserListsQuerySchema, validationErrorHandler),
    async (context) => {
      const user = getAuthUser(context)
      const query = context.req.valid('query')
      return jsonResult(context, await listUserLists(user.id, query))
    },
  )
}
