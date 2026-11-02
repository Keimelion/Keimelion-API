import { relations } from 'drizzle-orm'
import { users } from './users.schema.js'
import { images } from '../images/images.schema.js'
import { reservations } from '../reservations/reservations.schema.js'

export const usersRelations = relations(users, ({ one, many }) => ({
  avatarImage: one(images, {
    fields: [users.avatarImageId],
    references: [images.id],
  }),
  reservations: many(reservations),
}))
