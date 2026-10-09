import { jsonResult } from '../../../shared/utils/response.js'
import { listCategoryTree } from '../categories.service.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountListCategories(router: FeatureRouter): void {
  router.get('/', async (context) => {
    return jsonResult(context, await listCategoryTree())
  })
}
