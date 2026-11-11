import { randomBytes, randomUUID } from 'crypto'
import { ErrorCode, HttpStatus, WaitlistSignupStatuses } from '@keimelion/sdk/enums'
import type { Locale } from '@keimelion/sdk/enums'
import type {
  WaitlistConfirmRequestParsed,
  WaitlistCreateRequestParsed,
  WaitlistCreateResponseParsed,
  WaitlistUnsubscribeRequestParsed,
} from '@keimelion/sdk/schemas'
import { env } from '../../config/env.js'
import { sendMail } from '../../shared/mail/mail.sender.js'
import { readErrorName } from '../../shared/utils/error.js'
import { hmacSha256Base64Url } from '../../shared/utils/hash.js'
import { logger } from '../../shared/utils/logger.js'
import { serviceError } from '../../shared/utils/response.js'
import type { ServiceResult } from '../../shared/types/service.js'
import { buildWaitlistConfirmationEmail } from './emails/waitlist-confirmation.email.js'
import {
  clearConfirmationSentAt,
  confirmWaitlistEntryByToken,
  deleteWaitlistEntryByUnsubscribeToken,
  upsertPendingWaitlistEntry,
} from './waitlist.repository.js'

const HONEYPOT_HIT_EVENT = 'waitlist_honeypot_hit'
const CONFIRMATION_EMAIL_FAILED_EVENT = 'waitlist_confirmation_email_failed'
const WAITLIST_TOKEN_BYTE_LENGTH = 32
const CONFIRMATION_RESEND_COOLDOWN_MS = 15 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000
// Domain separation: the JWT secret also keys this HMAC, never for the same input.
const UNSUBSCRIBE_TOKEN_CONTEXT = 'waitlist-unsubscribe'

interface PendingConfirmation {
  entryId: string
  locale: Locale
  email: string
  confirmationToken: string
  unsubscribeToken: string
}

export async function createWaitlistEntry(
  input: WaitlistCreateRequestParsed,
  ip: string,
): Promise<ServiceResult<WaitlistCreateResponseParsed>> {
  if (isHoneypotFilled(input)) {
    logger.info({ event: HONEYPOT_HIT_EVENT, ip })
    return serviceError(ErrorCode.WAITLIST_HONEYPOT_TRIGGERED)
  }

  const pendingConfirmation = await requestConfirmation(input)
  if (pendingConfirmation !== null) void deliverConfirmationEmail(pendingConfirmation)

  return {
    data: { status: WaitlistSignupStatuses.PENDING_CONFIRMATION },
    httpStatus: HttpStatus.ACCEPTED,
  }
}

export async function confirmWaitlistEntry(
  input: WaitlistConfirmRequestParsed,
): Promise<ServiceResult<null>> {
  const isConfirmed = await confirmWaitlistEntryByToken(input.token, new Date())
  if (!isConfirmed) return serviceError(ErrorCode.WAITLIST_CONFIRMATION_TOKEN_INVALID)
  return { data: null, httpStatus: HttpStatus.NO_CONTENT }
}

export async function unsubscribeWaitlistEntry(
  input: WaitlistUnsubscribeRequestParsed,
): Promise<ServiceResult<null>> {
  await deleteWaitlistEntryByUnsubscribeToken(input.token)
  return { data: null, httpStatus: HttpStatus.NO_CONTENT }
}

function isHoneypotFilled(input: WaitlistCreateRequestParsed): boolean {
  return (input.honeypot ?? '').length > 0
}

async function requestConfirmation(
  input: WaitlistCreateRequestParsed,
): Promise<PendingConfirmation | null> {
  const now = Date.now()
  const newEntryId = randomUUID()
  const confirmationToken = generateWaitlistToken()
  const entryId = await upsertPendingWaitlistEntry({
    newEntryId,
    email: input.email,
    locale: input.locale,
    confirmationToken,
    newEntryUnsubscribeToken: deriveUnsubscribeToken(newEntryId),
    requestedAt: new Date(now),
    confirmationExpiresAt: new Date(now + env.WAITLIST_CONFIRMATION_VALIDITY_DAYS * ONE_DAY_MS),
    resendAllowedBefore: new Date(now - CONFIRMATION_RESEND_COOLDOWN_MS),
  })
  if (entryId === null) return null
  return {
    entryId,
    locale: input.locale,
    email: input.email,
    confirmationToken,
    unsubscribeToken: deriveUnsubscribeToken(entryId),
  }
}

function generateWaitlistToken(): string {
  return randomBytes(WAITLIST_TOKEN_BYTE_LENGTH).toString('base64url')
}

// Stable for the life of the entry: a resend never invalidates the unsubscribe link of an
// earlier email. The entry id is what an existing row returns on conflict.
function deriveUnsubscribeToken(entryId: string): string {
  return hmacSha256Base64Url(env.JWT_SECRET, `${UNSUBSCRIBE_TOKEN_CONTEXT}:${entryId}`)
}

// Runs after the response is sent: the landing gives up on the API after 5 s, so the signup never
// waits for the provider. A failed send releases the resend throttle so the visitor can retry.
async function deliverConfirmationEmail(pending: PendingConfirmation): Promise<void> {
  try {
    const email = buildWaitlistConfirmationEmail(pending)
    const result = await sendMail({ to: pending.email, ...email })
    if (result.isSuccess) return

    logger.warn({ event: CONFIRMATION_EMAIL_FAILED_EVENT, reason: result.reason })
    await clearConfirmationSentAt(pending.entryId, pending.confirmationToken)
  } catch (error) {
    logger.error({ event: CONFIRMATION_EMAIL_FAILED_EVENT, errorName: readErrorName(error) })
  }
}
