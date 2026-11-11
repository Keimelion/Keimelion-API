import { relations } from 'drizzle-orm'
import { reports } from './reports.schema.js'
import { users } from '../users/users.schema.js'

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.userId],
    references: [users.id],
  }),
}))
