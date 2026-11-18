import { z } from 'zod'

export const uuidParamSchema = z.object({
  id: z.guid(),
})

export const itemSourceParamSchema = z.object({
  id: z.guid(),
  sourceId: z.guid(),
})

export const listInviteParamSchema = z.object({
  id: z.guid(),
  inviteId: z.guid(),
})

export const listCollaboratorParamSchema = z.object({
  id: z.guid(),
  userId: z.guid(),
})

export type UuidParam = z.infer<typeof uuidParamSchema>
