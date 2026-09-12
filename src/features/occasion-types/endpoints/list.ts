import type { Hono } from 'hono'
import { listOccasionTypes } from '../occasion-types.service.js'

export function mountListOccasionTypes(router: Hono): void {
  router.get('/', async (context) => {
    const { data, httpStatus } = await listOccasionTypes()
    return context.json(data, httpStatus as 200)
  })
}
