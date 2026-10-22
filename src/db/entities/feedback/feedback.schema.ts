import { jsonb, pgEnum, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { FEEDBACK_STATUS_VALUES, FeedbackStatuses } from '../../../shared/enums/feedback-status.js'
import { users } from '../users/users.schema.js'

export const feedbackStatusEnum = pgEnum('feedback_status', FEEDBACK_STATUS_VALUES)

export const feedback = pgTable('feedback', {
  id: uuidPrimaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  context: jsonb('context'),
  status: feedbackStatusEnum('status').notNull().default(FeedbackStatuses.OPEN),
  ...timestamps(),
})

export type Feedback = typeof feedback.$inferSelect
