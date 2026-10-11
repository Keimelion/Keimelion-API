import { z } from 'zod'

export const MAX_TAGS_PER_LIST = 20

export const listTagParamSchema = z.object({
  id: z.string().uuid(),
  tagId: z.string().uuid(),
})
