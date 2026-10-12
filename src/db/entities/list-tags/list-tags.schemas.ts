import { z } from 'zod'

export const listTagParamSchema = z.object({
  id: z.string().uuid(),
  tagId: z.string().uuid(),
})
