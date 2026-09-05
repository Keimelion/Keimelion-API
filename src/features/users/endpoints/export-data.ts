import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { HonoContextKey } from '../../../shared/enums/context-key.js'
import type { AppVariables } from '../../../shared/types/app.js'
import { validationErrorHandler } from '../../../shared/utils/validation.js'
import { exportUserData } from '../users.service.js'

const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
})

export type ExportFormat = z.infer<typeof exportQuerySchema>['format']

export function mountExportData(router: Hono<{ Variables: AppVariables }>): void {
  router.get('/me/export', zValidator('query', exportQuerySchema, validationErrorHandler), async (context) => {
    const user = context.get(HonoContextKey.USER)
    const { format } = context.req.valid('query')
    const { body, contentType, filename } = await exportUserData(user.id, format)

    context.header('Content-Disposition', `attachment; filename="${filename}"`)
    context.header('Content-Type', contentType)
    return context.body(body)
  })
}
