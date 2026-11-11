import { z } from 'zod'

export const uuidParamSchema = z.object({
  id: z.guid(),
})

export const itemSourceParamSchema = z.object({
  id: z.guid(),
  sourceId: z.guid(),
})

export type UuidParam = z.infer<typeof uuidParamSchema>
