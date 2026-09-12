import type { Hono } from 'hono'
import { jsonResult } from '../../../shared/utils/response.js'
import { listOccasionTypes } from '../occasion-types.service.js'

export function mountListOccasionTypes(router: Hono): void {
  router.get('/', async (context) => {
    return jsonResult(context, await listOccasionTypes())
  })
}
