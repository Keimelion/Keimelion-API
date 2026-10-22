export const FeedbackStatuses = {
  OPEN: 'open',
  REVIEWED: 'reviewed',
  CLOSED: 'closed',
} as const

export type FeedbackStatus = (typeof FeedbackStatuses)[keyof typeof FeedbackStatuses]

export const FEEDBACK_STATUS_VALUES = Object.values(FeedbackStatuses) as [FeedbackStatus, ...FeedbackStatus[]]
