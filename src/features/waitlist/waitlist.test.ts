import { createHash } from 'crypto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErrorCode } from '@keimelion/sdk/enums'
import { MAX_WAITLIST_EMAIL_LENGTH, waitlistCreateResponseSchema } from '@keimelion/sdk/schemas'
import { db } from '../../db/client.js'
import { sendMail } from '../../shared/mail/mail.sender.js'
import { apiRequest } from '../../shared/test/api-request.js'
import { logger } from '../../shared/utils/logger.js'
import { buildWaitlistConfirmationEmail } from './emails/waitlist-confirmation.email.js'

vi.mock('../../shared/mail/mail.sender.js', () => ({ sendMail: vi.fn() }))

const WAITLIST_PATH = '/v1/public/waitlist'
const CONFIRM_PATH = '/v1/public/waitlist/confirm'
const UNSUBSCRIBE_PATH = '/v1/public/waitlist/unsubscribe'
const EMAIL = 'visitor@example.com'
const CLIENT_IP = '203.0.113.9'
const ENTRY_ROW = { id: '00000000-0000-0000-0000-000000000300' }
const EMAIL_DOMAIN = '@example.com'
const VALID_BODY = { email: EMAIL, locale: 'fr', consent: true }
const VALID_TOKEN = 'Ab-_'.repeat(10).concat('xyz')
const LANDING_URL = 'https://keimelion.test'
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const TOKEN_FRAGMENT_REGEX = /#token=([\w-]+)/g
const PENDING_CONFIRMATION_BODY = { status: 'pending_confirmation' }

interface UpsertedValues {
  email: string
  locale: string
  consentGivenAt: Date
  confirmationTokenHash: string
  confirmationTokenExpiresAt: Date
  confirmationSentAt: Date
  unsubscribeTokenHash: string
}

interface UpsertMock {
  valuesSpy: ReturnType<typeof vi.fn>
  conflictSpy: ReturnType<typeof vi.fn>
}

interface ValidationErrorBody {
  code: string
  metadata: { issues: { path: string }[] }
}

interface SentMail {
  to: string
  subject: string
  html: string
  text: string
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function mockUpsert(returnedRows: { id: string }[]): UpsertMock {
  const conflictSpy = vi.fn().mockReturnValueOnce({
    returning: vi.fn().mockResolvedValueOnce(returnedRows),
  })
  const valuesSpy = vi.fn().mockReturnValueOnce({ onConflictDoUpdate: conflictSpy })
  vi.mocked(db.insert).mockReturnValueOnce({ values: valuesSpy } as never)
  return { valuesSpy, conflictSpy }
}

function mockConfirmUpdate(returnedRows: { id: string }[]): ReturnType<typeof vi.fn> {
  const setSpy = vi.fn().mockReturnValueOnce({
    where: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce(returnedRows),
    }),
  })
  vi.mocked(db.update).mockReturnValueOnce({ set: setSpy } as never)
  return setSpy
}

function mockClearThrottleUpdate(): ReturnType<typeof vi.fn> {
  const setSpy = vi.fn().mockReturnValueOnce({ where: vi.fn().mockResolvedValueOnce(undefined) })
  vi.mocked(db.update).mockReturnValueOnce({ set: setSpy } as never)
  return setSpy
}

function postJson(path: string, body: unknown): Promise<Response> {
  return apiRequest(path, { method: 'POST', body, headers: { 'x-forwarded-for': CLIENT_IP } })
}

async function readIssuePaths(response: Response): Promise<string[]> {
  const body = (await response.json()) as ValidationErrorBody
  expect(body.code).toBe(ErrorCode.UNPROCESSABLE_ENTITY)
  return body.metadata.issues.map((issue) => issue.path)
}

async function waitForSentMail(): Promise<SentMail> {
  await vi.waitFor(() => {
    expect(sendMail).toHaveBeenCalledOnce()
  })
  return vi.mocked(sendMail).mock.calls[0]?.[0] as SentMail
}

function extractLinkTokens(mail: SentMail): string[] {
  return [...mail.text.matchAll(TOKEN_FRAGMENT_REGEX)].map((match) => match[1] ?? '')
}

function spyOnAllLogLevels(): () => string {
  const spies = (['debug', 'info', 'warn', 'error'] as const).map((level) =>
    vi.spyOn(logger, level).mockImplementation(() => undefined),
  )
  return () => JSON.stringify(spies.map((spy) => spy.mock.calls))
}

function findBoundDate(fragment: unknown): Date | null {
  if (fragment instanceof Date) return fragment
  if (typeof fragment !== 'object' || fragment === null) return null
  const { queryChunks, value } = fragment as { queryChunks?: unknown[]; value?: unknown }
  const values: unknown[] = Array.isArray(value) ? (value as unknown[]) : [value]
  const candidates = [...(queryChunks ?? []), ...values]
  return candidates.map(findBoundDate).find((date) => date !== null) ?? null
}

async function flushBackgroundWork(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve))
}

describe('POST /v1/public/waitlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sendMail).mockResolvedValue({ isSuccess: true, messageId: 'message-1' })
  })

  it('stores a new address unconfirmed and sends the confirmation email in its locale', async () => {
    const { valuesSpy } = mockUpsert([ENTRY_ROW])

    const response = await postJson(WAITLIST_PATH, VALID_BODY)

    expect(response.status).toBe(202)
    expect(waitlistCreateResponseSchema.parse(await response.json())).toEqual(
      PENDING_CONFIRMATION_BODY,
    )
    const values = valuesSpy.mock.calls[0]?.[0] as UpsertedValues
    expect(values).toMatchObject({ email: EMAIL, locale: 'fr' })
    expect(values).not.toHaveProperty('confirmedAt')
    const mail = await waitForSentMail()
    expect(mail.to).toBe(EMAIL)
    expect(mail.subject).toBe('Confirmez votre inscription à Keimêlion')
    expect(mail.text).toContain(`${LANDING_URL}/confirmer-inscription#token=`)
  })

  it('sends the English email for an English signup', async () => {
    mockUpsert([ENTRY_ROW])

    await postJson(WAITLIST_PATH, { ...VALID_BODY, locale: 'en' })

    const mail = await waitForSentMail()
    expect(mail.subject).toBe('Confirm your Keimêlion signup')
    expect(mail.text).toContain(`${LANDING_URL}/en/confirm-signup#token=`)
  })

  it('stores only sha256 hashes of the tokens sent in the email', async () => {
    const { valuesSpy, conflictSpy } = mockUpsert([ENTRY_ROW])

    await postJson(WAITLIST_PATH, VALID_BODY)

    const [confirmationToken = '', unsubscribeToken = ''] = extractLinkTokens(
      await waitForSentMail(),
    )
    const values = valuesSpy.mock.calls[0]?.[0] as UpsertedValues
    expect(values.confirmationTokenHash).toBe(sha256Hex(confirmationToken))
    expect(values.unsubscribeTokenHash).toBe(sha256Hex(unsubscribeToken))
    const { set } = conflictSpy.mock.calls[0]?.[0] as { set: object }
    const persisted = JSON.stringify([values, set])
    expect(persisted).not.toContain(confirmationToken)
    expect(persisted).not.toContain(unsubscribeToken)
  })

  it('issues 43-character base64url tokens', async () => {
    mockUpsert([ENTRY_ROW])

    await postJson(WAITLIST_PATH, VALID_BODY)

    const tokens = extractLinkTokens(await waitForSentMail())
    expect(tokens).toHaveLength(2)
    tokens.forEach((token) => {
      expect(token).toMatch(/^[\w-]{43}$/)
    })
  })

  it('sets the link validity and refreshes the tokens of an unconfirmed entry outside the cooldown', async () => {
    const { valuesSpy, conflictSpy } = mockUpsert([ENTRY_ROW])
    const before = Date.now()

    await postJson(WAITLIST_PATH, VALID_BODY)

    const values = valuesSpy.mock.calls[0]?.[0] as UpsertedValues
    const { set, setWhere } = conflictSpy.mock.calls[0]?.[0] as { set: object; setWhere: unknown }
    expect(values.confirmationTokenExpiresAt.getTime() - values.confirmationSentAt.getTime()).toBe(
      SEVEN_DAYS_MS,
    )
    expect(values.confirmationSentAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(set).toMatchObject({ confirmationTokenHash: values.confirmationTokenHash })
    expect(setWhere).toBeDefined()
    await waitForSentMail()
  })

  it('passes a resend cutoff of 15 minutes before the request to the upsert', async () => {
    const { conflictSpy } = mockUpsert([ENTRY_ROW])
    const before = Date.now()

    await postJson(WAITLIST_PATH, VALID_BODY)

    const { setWhere } = conflictSpy.mock.calls[0]?.[0] as { setWhere: unknown }
    const cutoff = findBoundDate(setWhere)
    expect(cutoff?.getTime()).toBeGreaterThanOrEqual(before - FIFTEEN_MINUTES_MS)
    expect(cutoff?.getTime()).toBeLessThanOrEqual(Date.now() - FIFTEEN_MINUTES_MS)
  })

  it('sends no email when the entry is confirmed or within the 15-minute cooldown', async () => {
    mockUpsert([])

    const response = await postJson(WAITLIST_PATH, VALID_BODY)

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual(PENDING_CONFIRMATION_BODY)
    await flushBackgroundWork()
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('answers every signup branch with the same status and body', async () => {
    mockUpsert([ENTRY_ROW])
    mockUpsert([])

    const emailSent = await postJson(WAITLIST_PATH, VALID_BODY)
    const noEmail = await postJson(WAITLIST_PATH, VALID_BODY)

    expect(noEmail.status).toBe(emailSent.status)
    expect(await noEmail.text()).toBe(await emailSent.text())
  })

  it('answers without waiting for the mail provider', async () => {
    mockUpsert([ENTRY_ROW])
    vi.mocked(sendMail).mockReturnValueOnce(new Promise(() => undefined))

    const response = await postJson(WAITLIST_PATH, VALID_BODY)

    expect(response.status).toBe(202)
  })

  it('still succeeds on a provider failure, logs it without secrets and releases the cooldown', async () => {
    const readLogs = spyOnAllLogLevels()
    mockUpsert([ENTRY_ROW])
    const clearSpy = mockClearThrottleUpdate()
    vi.mocked(sendMail).mockResolvedValueOnce({ isSuccess: false, reason: 'provider_error' })

    const response = await postJson(WAITLIST_PATH, VALID_BODY)

    expect(response.status).toBe(202)
    const tokens = extractLinkTokens(await waitForSentMail())
    await vi.waitFor(() => {
      expect(clearSpy).toHaveBeenCalledWith({ confirmationSentAt: null })
    })
    expect(logger.warn).toHaveBeenCalledWith({
      event: 'waitlist_confirmation_email_failed',
      reason: 'provider_error',
    })
    tokens.forEach((token) => {
      expect(readLogs()).not.toContain(token)
    })
    expect(readLogs()).not.toContain(EMAIL)
  })

  it('logs the error name only when releasing the cooldown fails', async () => {
    const readLogs = spyOnAllLogLevels()
    mockUpsert([ENTRY_ROW])
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockRejectedValueOnce(new Error(`Failed query, params: ${EMAIL}`)),
      }),
    } as never)
    vi.mocked(sendMail).mockResolvedValueOnce({ isSuccess: false, reason: 'timeout' })

    const response = await postJson(WAITLIST_PATH, VALID_BODY)

    expect(response.status).toBe(202)
    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith({
        event: 'waitlist_confirmation_email_failed',
        errorName: 'Error',
      })
    })
    expect(readLogs()).not.toContain(EMAIL)
  })

  it('returns 400, logs the IP without the email and writes nothing on a honeypot hit', async () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined)

    const response = await postJson(WAITLIST_PATH, {
      ...VALID_BODY,
      honeypot: 'https://spam.example',
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { code: string }
    expect(body.code).toBe(ErrorCode.WAITLIST_HONEYPOT_TRIGGERED)
    expect(db.insert).not.toHaveBeenCalled()
    await flushBackgroundWork()
    expect(sendMail).not.toHaveBeenCalled()
    expect(infoSpy).toHaveBeenCalledWith({ event: 'waitlist_honeypot_hit', ip: CLIENT_IP })
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain(EMAIL)
  })

  it('treats an empty honeypot as a real signup', async () => {
    mockUpsert([ENTRY_ROW])

    const response = await postJson(WAITLIST_PATH, { ...VALID_BODY, honeypot: '' })

    expect(response.status).toBe(202)
    await waitForSentMail()
  })

  it('normalises the email before storing it', async () => {
    const { valuesSpy } = mockUpsert([ENTRY_ROW])

    await postJson(WAITLIST_PATH, { ...VALID_BODY, email: '  Visitor@Example.COM ' })

    expect((valuesSpy.mock.calls[0]?.[0] as UpsertedValues).email).toBe(EMAIL)
    expect((await waitForSentMail()).to).toBe(EMAIL)
  })

  it.each([
    ['missing', { email: EMAIL, locale: 'fr' }],
    ['false', { ...VALID_BODY, consent: false }],
  ])('returns 422 on the consent path when consent is %s', async (_label, body) => {
    const response = await postJson(WAITLIST_PATH, body)

    expect(response.status).toBe(422)
    expect(await readIssuePaths(response)).toEqual(['consent'])
    expect(db.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['malformed', 'not-an-email'],
    ['longer than the maximum', `${'a'.repeat(MAX_WAITLIST_EMAIL_LENGTH)}${EMAIL_DOMAIN}`],
  ])('returns 422 on the email path when the email is %s', async (_label, email) => {
    const response = await postJson(WAITLIST_PATH, { ...VALID_BODY, email })

    expect(response.status).toBe(422)
    expect(await readIssuePaths(response)).toEqual(['email'])
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('returns 422 for an unsupported locale', async () => {
    const response = await postJson(WAITLIST_PATH, { ...VALID_BODY, locale: 'de' })

    expect(response.status).toBe(422)
    expect(await readIssuePaths(response)).toEqual(['locale'])
  })

  it('returns 500 and sends nothing when the upsert fails', async () => {
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        onConflictDoUpdate: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockRejectedValueOnce(new Error('connection lost')),
        }),
      }),
    } as never)

    const response = await postJson(WAITLIST_PATH, VALID_BODY)

    expect(response.status).toBe(500)
    expect(sendMail).not.toHaveBeenCalled()
  })
})

describe('POST /v1/public/waitlist/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 204 and sets confirmed_at for a valid token', async () => {
    const setSpy = mockConfirmUpdate([ENTRY_ROW])

    const response = await postJson(CONFIRM_PATH, { token: VALID_TOKEN })

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(setSpy).toHaveBeenCalledWith({ confirmedAt: expect.anything() as unknown })
  })

  it('stays a success when the same token is confirmed again', async () => {
    mockConfirmUpdate([ENTRY_ROW])
    mockConfirmUpdate([ENTRY_ROW])

    const first = await postJson(CONFIRM_PATH, { token: VALID_TOKEN })
    const repeated = await postJson(CONFIRM_PATH, { token: VALID_TOKEN })

    expect([first.status, repeated.status]).toEqual([204, 204])
  })

  it('returns 400 with the dedicated code for an unknown or expired token', async () => {
    mockConfirmUpdate([])

    const response = await postJson(CONFIRM_PATH, { token: VALID_TOKEN })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { code: string; message: string }
    expect(body.code).toBe(ErrorCode.WAITLIST_CONFIRMATION_TOKEN_INVALID)
    expect(body.message).toBe('This confirmation link is invalid or has expired')
  })

  it.each([
    ['missing', {}],
    ['malformed', { token: 'not a token' }],
  ])('returns 422 on the token path when the token is %s', async (_label, body) => {
    const response = await postJson(CONFIRM_PATH, body)

    expect(response.status).toBe(422)
    expect(new Set(await readIssuePaths(response))).toEqual(new Set(['token']))
    expect(db.update).not.toHaveBeenCalled()
  })

  it('returns 500 when the update fails', async () => {
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockRejectedValueOnce(new Error('connection lost')),
        }),
      }),
    } as never)

    const response = await postJson(CONFIRM_PATH, { token: VALID_TOKEN })

    expect(response.status).toBe(500)
  })
})

describe('POST /v1/public/waitlist/unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hard-deletes the entry and returns 204', async () => {
    const response = await postJson(UNSUBSCRIBE_PATH, { token: VALID_TOKEN })

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(db.delete).toHaveBeenCalledOnce()
    expect(db.update).not.toHaveBeenCalled()
  })

  it('returns 204 again when the same token is used twice', async () => {
    const first = await postJson(UNSUBSCRIBE_PATH, { token: VALID_TOKEN })
    const repeated = await postJson(UNSUBSCRIBE_PATH, { token: VALID_TOKEN })

    expect([first.status, repeated.status]).toEqual([204, 204])
  })

  it('returns 204 for an unknown token so that existence never leaks', async () => {
    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockResolvedValueOnce([]),
    } as never)

    const response = await postJson(UNSUBSCRIBE_PATH, { token: VALID_TOKEN })

    expect(response.status).toBe(204)
  })

  it('returns 422 for a malformed token', async () => {
    const response = await postJson(UNSUBSCRIBE_PATH, { token: 'short' })

    expect(response.status).toBe(422)
    expect(await readIssuePaths(response)).toEqual(['token'])
    expect(db.delete).not.toHaveBeenCalled()
  })

  it('returns 500 when the delete fails', async () => {
    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockRejectedValueOnce(new Error('connection lost')),
    } as never)

    const response = await postJson(UNSUBSCRIBE_PATH, { token: VALID_TOKEN })

    expect(response.status).toBe(500)
  })
})

describe('buildWaitlistConfirmationEmail', () => {
  const tokens = { confirmationToken: 'confirm-token', unsubscribeToken: 'delete-token' }

  it.each([
    ['fr', '/confirmer-inscription', '/supprimer-inscription', '/politique-de-confidentialite'],
    ['en', '/en/confirm-signup', '/en/delete-signup', '/en/privacy-policy'],
  ] as const)(
    'links the %s landing pages with tokens in the fragment',
    (locale, confirm, remove, privacy) => {
      const email = buildWaitlistConfirmationEmail({ locale, ...tokens })

      for (const body of [email.html, email.text]) {
        expect(body).toContain(`${LANDING_URL}${confirm}#token=confirm-token`)
        expect(body).toContain(`${LANDING_URL}${remove}#token=delete-token`)
        expect(body).toContain(`${LANDING_URL}${privacy}`)
        expect(body).not.toContain('?token=')
      }
    },
  )

  it('announces the configured validity in the info box and the ignore line', () => {
    const email = buildWaitlistConfirmationEmail({ locale: 'fr', ...tokens })

    expect(email.text).toContain('Ce lien est valable 7 jours.')
    expect(email.text).toContain('votre adresse sera supprimée sous 7 jours.')
  })

  it('renders the final English copy of the KEI-164 design', () => {
    const email = buildWaitlistConfirmationEmail({ locale: 'en', ...tokens })

    expect(email.html).toContain('<html lang="en">')
    expect(email.text).toMatch(/^Almost wrapped!\nJust one click left\.\n\nHello,/)
    expect(email.text).toContain('Confirm my signup:\n')
    expect(email.text).toContain('See you soon,\nThe Keimêlion team')
    expect(email.html).toContain(
      'One click to join the waitlist, and we&#39;ll let you know at launch.',
    )
  })
})
