import { authMiddleware } from './auth.js'
import { requireAdminMiddleware } from './require-admin.js'

export const adminOnly = [authMiddleware, requireAdminMiddleware] as const
