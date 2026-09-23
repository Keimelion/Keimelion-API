export const ModerationStatuses = {
  APPROVED: 'approved',
  PENDING: 'pending',
  REJECTED: 'rejected',
} as const

export type ModerationStatus = (typeof ModerationStatuses)[keyof typeof ModerationStatuses]

export const MODERATION_STATUS_VALUES = Object.values(ModerationStatuses) as [ModerationStatus, ...ModerationStatus[]]
