import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { localeEnum } from '../../../shared/db/translations.js'

export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: uuidPrimaryKey(),
    email: text('email').notNull(),
    locale: localeEnum('locale').notNull(),
    consentGivenAt: timestamp('consent_given_at', { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (table) => [unique('waitlist_entries_email_locale_unique').on(table.email, table.locale)],
)

export type WaitlistEntry = typeof waitlistEntries.$inferSelect
