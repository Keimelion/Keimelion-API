import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, getAuthUser } from '../../../shared/middlewares/auth.js'
import type { FeatureRouter } from '../../../shared/types/app.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { exportUserData } from '../users.service.js'

const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
})

export type ExportFormat = z.infer<typeof exportQuerySchema>['format']

export function mountExportData(router: FeatureRouter): void {
  router.get('/me/export', authMiddleware, zValidator('query', exportQuerySchema, validationErrorHandler), async (context) => {
    const user = getAuthUser(context)
    const { format } = context.req.valid('query')
    const { body, contentType, filename } = await exportUserData(user.id, format)

    context.header('Content-Disposition', `attachment; filename="${filename}"`)
    context.header('Content-Type', contentType)
    return context.body(body)
  })
}
