import { relations } from 'drizzle-orm'
import { users } from './users.schema.js'
import { images } from '../images/images.schema.js'

export const usersRelations = relations(users, ({ one }) => ({
  avatarImage: one(images, {
    fields: [users.avatarImageId],
    references: [images.id],
  }),
}))
