import { and, isNull, lt } from 'drizzle-orm'
import { db } from '../../client.js'
import { waitlistEntries } from './waitlist.schema.js'

export async function deleteExpiredUnconfirmedWaitlistEntries(now: Date): Promise<number> {
  const deletedRows = await db
    .delete(waitlistEntries)
    .where(
      and(isNull(waitlistEntries.confirmedAt), lt(waitlistEntries.confirmationTokenExpiresAt, now)),
    )
    .returning({ id: waitlistEntries.id })
  return deletedRows.length
}

export async function deleteWaitlistEntriesLaunchEmailedBefore(cutoff: Date): Promise<number> {
  const deletedRows = await db
    .delete(waitlistEntries)
    .where(lt(waitlistEntries.launchEmailSentAt, cutoff))
    .returning({ id: waitlistEntries.id })
  return deletedRows.length
}
