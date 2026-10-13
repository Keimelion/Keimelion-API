import { adminOnly } from '../../../../shared/middlewares/admin-only.js'
import { jsonResult } from '../../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../../shared/types/app.js'
import { listCategories } from '../admin-categories.service.js'

export function mountListCategories(router: FeatureRouter): void {
  router.get('/', ...adminOnly, async (context) => {
    return jsonResult(context, await listCategories())
  })
}
