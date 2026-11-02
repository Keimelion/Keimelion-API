import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { nonNegativeCheck, nonNegativeInt } from '../../../shared/db/checks.js'
import { users } from '../users/users.schema.js'

export const images = pgTable(
  'images',
  {
    id: uuidPrimaryKey(),
    hash: text('hash').notNull(),
    fileKey: text('file_key').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: nonNegativeInt('size_bytes').notNull(),
    width: nonNegativeInt('width').notNull(),
    height: nonNegativeInt('height').notNull(),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps(),
  },
  (table) => [
    index('images_uploaded_by_idx').on(table.uploadedBy),
    nonNegativeCheck(table.sizeBytes),
    nonNegativeCheck(table.width),
    nonNegativeCheck(table.height),
  ],
)

export type Image = typeof images.$inferSelect
