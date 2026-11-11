import { sql } from 'drizzle-orm'
import { index, pgTable, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core'
import { timestamps, uuidPrimaryKey } from '../../../shared/db/columns.js'
import { localeEnum } from '../../../shared/db/translations.js'
import { SHA256_HEX_LENGTH } from '../../../shared/utils/hash.js'

export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: uuidPrimaryKey(),
    email: text('email').notNull(),
    locale: localeEnum('locale').notNull(),
    consentGivenAt: timestamp('consent_given_at', { withTimezone: true }).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    confirmationTokenHash: varchar('confirmation_token_hash', { length: SHA256_HEX_LENGTH }),
    confirmationTokenExpiresAt: timestamp('confirmation_token_expires_at', { withTimezone: true }),
    confirmationSentAt: timestamp('confirmation_sent_at', { withTimezone: true }),
    unsubscribeTokenHash: varchar('unsubscribe_token_hash', { length: SHA256_HEX_LENGTH }),
    launchEmailSentAt: timestamp('launch_email_sent_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    unique('waitlist_entries_email_locale_unique').on(table.email, table.locale),
    unique('waitlist_entries_confirmation_token_hash_unique').on(table.confirmationTokenHash),
    unique('waitlist_entries_unsubscribe_token_hash_unique').on(table.unsubscribeTokenHash),
    index('waitlist_entries_unconfirmed_expires_at_idx')
      .on(table.confirmationTokenExpiresAt)
      .where(sql`${table.confirmedAt} IS NULL`),
    index('waitlist_entries_launch_email_sent_at_idx')
      .on(table.launchEmailSentAt)
      .where(sql`${table.launchEmailSentAt} IS NOT NULL`),
  ],
)

export type WaitlistEntry = typeof waitlistEntries.$inferSelect
