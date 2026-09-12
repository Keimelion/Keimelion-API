import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import { jsonResult } from '../../../shared/utils/response.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { deleteAccount } from '../users.service.js'

export function mountDeleteAccount(router: FeatureRouter): void {
  router.delete('/me', authMiddleware, async (context) => {
    const user = getAuthUser(context)
    return jsonResult(context, await deleteAccount(user.id, user.email))
  })
}
