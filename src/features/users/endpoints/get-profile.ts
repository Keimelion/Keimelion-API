import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { jsonResult } from '../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { getProfile } from '../users.service.js'

export function mountGetProfile(router: FeatureRouter): void {
  router.get('/me', authMiddleware, async (context) => {
    const user = getAuthUser(context)
    return jsonResult(context, await getProfile(user.id))
  })
}
