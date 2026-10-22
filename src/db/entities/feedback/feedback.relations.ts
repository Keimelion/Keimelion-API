import { relations } from 'drizzle-orm'
import { feedback } from './feedback.schema.js'
import { users } from '../users/users.schema.js'

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(users, {
    fields: [feedback.userId],
    references: [users.id],
  }),
}))
