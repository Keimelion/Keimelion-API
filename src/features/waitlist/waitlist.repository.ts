import { and, eq, gt, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Locale } from '@keimelion/sdk/enums'
import { db } from '../../db/client.js'
import { waitlistEntries } from '../../db/entities/waitlist/waitlist.schema.js'
import { hashSha256Hex } from '../../shared/utils/hash.js'

export interface PendingWaitlistEntryInput {
  email: string
  locale: Locale
  confirmationToken: string
  unsubscribeToken: string
  requestedAt: Date
  confirmationExpiresAt: Date
  resendAllowedBefore: Date
}

// One atomic statement covers every signup branch: a new address is inserted, an unconfirmed one
// gets fresh tokens unless a confirmation was sent after `resendAllowedBefore`, a confirmed one is
// left untouched. A returned id means a confirmation email must be sent.
export async function upsertPendingWaitlistEntry(
  input: PendingWaitlistEntryInput,
): Promise<string | null> {
  const tokenColumns = {
    consentGivenAt: input.requestedAt,
    confirmationTokenHash: hashSha256Hex(input.confirmationToken),
    confirmationTokenExpiresAt: input.confirmationExpiresAt,
    confirmationSentAt: input.requestedAt,
    unsubscribeTokenHash: hashSha256Hex(input.unsubscribeToken),
  }
  const [entry] = await db
    .insert(waitlistEntries)
    .values({ email: input.email, locale: input.locale, ...tokenColumns })
    .onConflictDoUpdate({
      target: [waitlistEntries.email, waitlistEntries.locale],
      set: tokenColumns,
      setWhere: isUnconfirmedAndResendAllowed(input.resendAllowedBefore),
    })
    .returning({ id: waitlistEntries.id })
  return entry?.id ?? null
}

// Only clears the throttle if no newer confirmation replaced the failed one in the meantime.
export async function clearConfirmationSentAt(
  entryId: string,
  confirmationToken: string,
): Promise<void> {
  await db
    .update(waitlistEntries)
    .set({ confirmationSentAt: null })
    .where(
      and(
        eq(waitlistEntries.id, entryId),
        eq(waitlistEntries.confirmationTokenHash, hashSha256Hex(confirmationToken)),
      ),
    )
}

// A confirmed entry stays confirmed when its link is followed again, even after expiry.
export async function confirmWaitlistEntryByToken(token: string, now: Date): Promise<boolean> {
  const confirmedRows = await db
    .update(waitlistEntries)
    .set({
      confirmedAt: sql`coalesce(${waitlistEntries.confirmedAt}, ${sql.param(now, waitlistEntries.confirmedAt)})`,
    })
    .where(
      and(
        eq(waitlistEntries.confirmationTokenHash, hashSha256Hex(token)),
        or(
          isNotNull(waitlistEntries.confirmedAt),
          gt(waitlistEntries.confirmationTokenExpiresAt, now),
        ),
      ),
    )
    .returning({ id: waitlistEntries.id })
  return confirmedRows.length > 0
}

export async function deleteWaitlistEntryByUnsubscribeToken(token: string): Promise<void> {
  await db
    .delete(waitlistEntries)
    .where(eq(waitlistEntries.unsubscribeTokenHash, hashSha256Hex(token)))
}

function isUnconfirmedAndResendAllowed(resendAllowedBefore: Date): SQL {
  const { confirmedAt, confirmationSentAt } = waitlistEntries
  return sql`${isNull(confirmedAt)} AND (${isNull(confirmationSentAt)} OR ${lt(confirmationSentAt, resendAllowedBefore)})`
}
