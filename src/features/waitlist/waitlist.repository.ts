import { db } from '../../db/client.js'
import { waitlistEntries } from '../../db/entities/waitlist/waitlist.schema.js'
import type { Locale } from '@keimelion/sdk/enums'

export async function insertWaitlistEntryIfAbsent(email: string, locale: Locale): Promise<boolean> {
  const insertedRows = await db
    .insert(waitlistEntries)
    .values({ email, locale, consentGivenAt: new Date() })
    .onConflictDoNothing({ target: [waitlistEntries.email, waitlistEntries.locale] })
    .returning({ id: waitlistEntries.id })
  return insertedRows.length > 0
}
