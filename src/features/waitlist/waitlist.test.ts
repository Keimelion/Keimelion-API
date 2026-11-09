import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErrorCode } from '@keimelion/sdk/enums'
import { MAX_WAITLIST_EMAIL_LENGTH, waitlistCreateResponseSchema } from '@keimelion/sdk/schemas'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'
import { logger } from '../../shared/utils/logger.js'

const WAITLIST_PATH = '/v1/public/waitlist'
const EMAIL = 'visitor@example.com'
const CLIENT_IP = '203.0.113.9'
const INSERTED_ROW = { id: '00000000-0000-0000-0000-000000000300' }
const EMAIL_DOMAIN = '@example.com'
const VALID_BODY = { email: EMAIL, locale: 'fr', consent: true }

interface InsertedValues {
  email: string
  locale: string
  consentGivenAt: Date
}

interface ValidationErrorBody {
  code: string
  metadata: { issues: { path: string }[] }
}

function mockInsertOnConflict(returnedRows: { id: string }[]): ReturnType<typeof vi.fn> {
  const valuesSpy = vi.fn().mockReturnValueOnce({
    onConflictDoNothing: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce(returnedRows),
    }),
  })
  vi.mocked(db.insert).mockReturnValueOnce({ values: valuesSpy } as never)
  return valuesSpy
}

function postWaitlist(body: unknown): Promise<Response> {
  return apiRequest(WAITLIST_PATH, {
    method: 'POST',
    body,
    headers: { 'x-forwarded-for': CLIENT_IP },
  })
}

async function readIssuePaths(response: Response): Promise<string[]> {
  const body = (await response.json()) as ValidationErrorBody
  expect(body.code).toBe(ErrorCode.UNPROCESSABLE_ENTITY)
  return body.metadata.issues.map((issue) => issue.path)
}

describe('POST /v1/public/waitlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 201 subscribed on first signup and records the consent timestamp', async () => {
    const valuesSpy = mockInsertOnConflict([INSERTED_ROW])

    const response = await postWaitlist(VALID_BODY)

    expect(response.status).toBe(201)
    expect(waitlistCreateResponseSchema.parse(await response.json())).toEqual({
      status: 'subscribed',
    })
    const insertedValues = valuesSpy.mock.calls[0]?.[0] as InsertedValues
    expect(insertedValues.email).toBe(EMAIL)
    expect(insertedValues.locale).toBe('fr')
    expect(insertedValues.consentGivenAt).toBeInstanceOf(Date)
  })

  it('normalises the email before inserting it', async () => {
    const valuesSpy = mockInsertOnConflict([INSERTED_ROW])

    await postWaitlist({ ...VALID_BODY, email: '  Visitor@Example.COM ' })

    const insertedValues = valuesSpy.mock.calls[0]?.[0] as InsertedValues
    expect(insertedValues.email).toBe(EMAIL)
  })

  it('returns 200 already_subscribed when the email and locale already exist', async () => {
    mockInsertOnConflict([])

    const response = await postWaitlist(VALID_BODY)

    expect(response.status).toBe(200)
    expect(waitlistCreateResponseSchema.parse(await response.json())).toEqual({
      status: 'already_subscribed',
    })
    expect(db.insert).toHaveBeenCalledOnce()
  })

  it('returns 201 for the same email on another locale', async () => {
    mockInsertOnConflict([INSERTED_ROW])
    const valuesSpy = mockInsertOnConflict([INSERTED_ROW])

    await postWaitlist(VALID_BODY)
    const response = await postWaitlist({ ...VALID_BODY, locale: 'en' })

    expect(response.status).toBe(201)
    expect(waitlistCreateResponseSchema.parse(await response.json())).toEqual({
      status: 'subscribed',
    })
    expect((valuesSpy.mock.calls[0]?.[0] as InsertedValues).locale).toBe('en')
  })

  it.each([
    ['missing', { email: EMAIL, locale: 'fr' }],
    ['false', { ...VALID_BODY, consent: false }],
  ])('returns 422 on the consent path when consent is %s', async (_label, body) => {
    const response = await postWaitlist(body)

    expect(response.status).toBe(422)
    expect(await readIssuePaths(response)).toEqual(['consent'])
    expect(db.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['malformed', 'not-an-email'],
    ['longer than the maximum', `${'a'.repeat(MAX_WAITLIST_EMAIL_LENGTH)}${EMAIL_DOMAIN}`],
  ])('returns 422 on the email path when the email is %s', async (_label, email) => {
    const response = await postWaitlist({ ...VALID_BODY, email })

    expect(response.status).toBe(422)
    expect(await readIssuePaths(response)).toEqual(['email'])
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('returns 422 for an unsupported locale', async () => {
    const response = await postWaitlist({ ...VALID_BODY, locale: 'de' })

    expect(response.status).toBe(422)
    expect(await readIssuePaths(response)).toEqual(['locale'])
  })

  it('returns 400, logs the IP without the email and writes nothing on a honeypot hit', async () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined)

    const response = await postWaitlist({ ...VALID_BODY, honeypot: 'https://spam.example' })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { code: string }
    expect(body.code).toBe(ErrorCode.WAITLIST_HONEYPOT_TRIGGERED)
    expect(db.insert).not.toHaveBeenCalled()
    expect(infoSpy).toHaveBeenCalledWith({ event: 'waitlist_honeypot_hit', ip: CLIENT_IP })
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain(EMAIL)
  })

  it('treats an empty honeypot as a real signup', async () => {
    mockInsertOnConflict([INSERTED_ROW])

    const response = await postWaitlist({ ...VALID_BODY, honeypot: '' })

    expect(response.status).toBe(201)
  })

  it('returns 500 when the insert fails', async () => {
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        onConflictDoNothing: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockRejectedValueOnce(new Error('connection lost')),
        }),
      }),
    } as never)

    const response = await postWaitlist(VALID_BODY)

    expect(response.status).toBe(500)
  })
})
