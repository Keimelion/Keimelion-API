import type { Feedback } from '../../db/entities/feedback/feedback.schema.js'
import type { FeedbackStatus } from '../enums/feedback-status.js'

export interface FeedbackDetail {
  id: string
  userId: string | null
  title: string
  description: string
  context: Record<string, unknown> | null
  status: FeedbackStatus
  createdAt: Date
  updatedAt: Date
}

export function toFeedbackDetail(row: Feedback): FeedbackDetail {
  return {
    id: row.id,
    userId: row.userId ?? null,
    title: row.title,
    description: row.description,
    context: (row.context as Record<string, unknown> | null) ?? null,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
