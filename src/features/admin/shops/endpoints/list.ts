import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import { paginationQuerySchema } from '../../../../shared/schemas/pagination.js'
import { sortQuerySchema } from '../../../../shared/schemas/sort.js'
import { validationErrorHandler } from '../../../../shared/utils/validation.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { listShops } from '../admin-shops.service.js'

export const ADMIN_SHOPS_SORT_FIELDS = [
  'name',
  'slug',
  'sortOrder',
  'createdAt',
  'updatedAt',
] as const

const booleanStringSchema = z.enum(['true', 'false']).transform((value) => value === 'true')

const listShopsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(120).optional(),
  isActive: booleanStringSchema.optional(),
  isAffiliated: booleanStringSchema.optional(),
  hasDomain: booleanStringSchema.optional(),
  sort: sortQuerySchema(ADMIN_SHOPS_SORT_FIELDS),
})

export type ListShopsInput = z.infer<typeof listShopsQuerySchema>

export function mountListShops(router: FeatureRouter): void {
  router.get(
    '/',
    ...adminOnly,
    zValidator('query', listShopsQuerySchema, validationErrorHandler),
    async (context) => {
      const query = context.req.valid('query')
      return jsonResult(context, await listShops(query))
    },
  )
}
