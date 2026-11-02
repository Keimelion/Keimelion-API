import { z } from 'zod'

export const uuidParamSchema = z.object({
  id: z.guid(),
})

export type UuidParam = z.infer<typeof uuidParamSchema>
