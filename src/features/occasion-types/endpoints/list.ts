import { jsonResult } from '../../../shared/utils/response.js'
import { listOccasionTypes } from '../occasion-types.service.js'
import { getLocale } from '../../../shared/middlewares/resolve-locale.js'
import type { FeatureRouter } from '../../../shared/types/app.js'

export function mountListOccasionTypes(router: FeatureRouter): void {
  router.get('/', async (context) => {
    const locale = getLocale(context)
    return jsonResult(context, await listOccasionTypes(locale))
  })
}
