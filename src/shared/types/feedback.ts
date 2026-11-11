import type { Feedback } from '../../db/entities/feedback/feedback.schema.js'
import type { FeedbackDetailParsed } from '@keimelion/sdk/schemas'

export type FeedbackDetail = FeedbackDetailParsed

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
