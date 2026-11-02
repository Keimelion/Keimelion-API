export const InviteStatuses = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  REVOKED: 'revoked',
} as const

export type InviteStatus = (typeof InviteStatuses)[keyof typeof InviteStatuses]

export const INVITE_STATUS_VALUES = Object.values(InviteStatuses) as [InviteStatus, ...InviteStatus[]]
