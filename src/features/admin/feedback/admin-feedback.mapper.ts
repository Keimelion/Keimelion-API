import type { Feedback } from '../../../db/entities/feedback/feedback.schema.js'
import type { User } from '../../../db/entities/users/users.schema.js'
import { toFeedbackDetail } from '../../../shared/types/feedback.js'
import type { AdminFeedbackDetailParsed } from '@keimelion/sdk/schemas'

export type AdminFeedback = AdminFeedbackDetailParsed

export interface FeedbackRowWithUser extends Feedback {
  user: Pick<User, 'id' | 'username' | 'email'> | null
}

export function toAdminFeedback(row: FeedbackRowWithUser): AdminFeedback {
  return {
    ...toFeedbackDetail(row),
    user: row.user ? { id: row.user.id, username: row.user.username ?? null, email: row.user.email } : null,
  }
}
