import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { db } from '../../db/client.js'
import { env } from '../../config/env.js'
import { ErrorCode } from '@keimelion/sdk/enums'
import {
  apiErrorBodySchema,
  forgotPasswordResponseSchema,
  loginResponseSchema,
  logoutResponseSchema,
  refreshResponseSchema,
  registerResponseSchema,
  resetPasswordResponseSchema,
  validationErrorMetadataSchema,
  verifyEmailResponseSchema,
} from '@keimelion/sdk/schemas'
import { NodeEnvs } from '../../shared/enums/node-env.js'
import { sendMail } from '../../shared/mail/mail.sender.js'
import { apiMultipartRequest, apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'
import { hashSha256Hex } from '../../shared/utils/hash.js'
import { logger } from '../../shared/utils/logger.js'

vi.mock('../../shared/mail/mail.sender.js', () => ({ sendMail: vi.fn() }))

const TEST_REFRESH_TOKEN_HASH = 'a'.repeat(64)

const VALID_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'user@example.com',
  username: 'testuser',
  passwordHash: '$2a$04$somevalidhashvalue.thatislong.enoughfortest',
  authProvider: 'email' as const,
  role: 'user' as const,
  avatarImageId: null,
  isCgvAccepted: true,
  cgvAcceptedAt: new Date('2024-01-01'),
  isMarketingOptedIn: false,
  defaultCurrencyCode: 'EUR',
  emailVerifyToken: null,
  emailVerifyTokenExpiresAt: null,
  emailVerifiedAt: new Date('2024-01-02'),
  passwordResetToken: null,
  passwordResetTokenExpiresAt: null,
  lastActiveAt: null,
  activatedAt: new Date('2024-01-01'),
  userStatus: 'active' as const,
  deletedAt: null,
  bannedAt: null,
  banReason: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(VALID_USER.id)

const VALID_REFRESH_TOKEN_ROW = {
  id: '00000000-0000-0000-0000-000000000010',
  userId: VALID_USER.id,
  tokenHash: TEST_REFRESH_TOKEN_HASH,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date('2024-01-01'),
  revokedAt: null,
}

const WEB_APP_URL = 'https://app.keimelion.test'
const BACKOFFICE_URL = 'https://backoffice.keimelion.test'
const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_MINUTE_MS = 60 * 1000
const MAIL_SENT = { isSuccess: true, messageId: 'message-1' } as const

interface SentMail {
  to: string
  subject: string
  html: string
  text: string
}

interface PasswordResetUpdate {
  passwordResetToken: string
  passwordResetTokenExpiresAt: Date
}

async function waitForSentMail(): Promise<SentMail> {
  await vi.waitFor(() => {
    expect(sendMail).toHaveBeenCalledOnce()
  })
  return vi.mocked(sendMail).mock.calls[0]?.[0] as SentMail
}

async function flushBackgroundWork(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve))
}

function spyOnAllLogLevels(): () => string {
  const spies = (['debug', 'info', 'warn', 'error'] as const).map((level) =>
    vi.spyOn(logger, level).mockImplementation(() => undefined),
  )
  return () => JSON.stringify(spies.map((spy) => spy.mock.calls))
}

function mockPasswordResetUpdate(): ReturnType<typeof vi.fn> {
  const setSpy = vi.fn().mockReturnValueOnce({ where: vi.fn().mockResolvedValueOnce(undefined) })
  vi.mocked(db.update).mockReturnValueOnce({ set: setSpy } as never)
  return setSpy
}

function postForgotPassword(email: string, headers: Record<string, string> = {}): Promise<Response> {
  return apiRequest('/v1/auth/forgot-password', { method: 'POST', body: { email }, headers })
}

function mockInsertReturning(returnValue: unknown): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([returnValue]),
    }),
  } as never)
}

function mockInsertNoReturning(): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockResolvedValueOnce(undefined),
  } as never)
}

describe('POST /v1/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sendMail).mockResolvedValue(MAIL_SENT)
  })

  function mockRegistrationInserts(): ReturnType<typeof vi.fn> {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)
    const valuesSpy = vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([VALID_USER]),
    })
    vi.mocked(db.insert).mockReturnValueOnce({ values: valuesSpy } as never)
    mockInsertNoReturning()
    return valuesSpy
  }

  function postRegister(headers: Record<string, string> = {}): Promise<Response> {
    return apiRequest('/v1/auth/register', {
      method: 'POST',
      body: { email: 'user@example.com', password: 'securepassword123' },
      headers,
    })
  }

  it('activates the account at registration and stores the unverified status', async () => {
    const valuesSpy = mockRegistrationInserts()

    const response = await postRegister()

    const { activatedAt, userStatus } = valuesSpy.mock.calls[0]?.[0] as { activatedAt: unknown; userStatus: string }
    expect(response.status).toBe(201)
    expect(activatedAt).toBeInstanceOf(Date)
    expect(userStatus).toBe('unverified')
  })

  it('sends a French verification email by default, linking the web app with the stored token', async () => {
    const valuesSpy = mockRegistrationInserts()

    const response = await postRegister()

    const mail = await waitForSentMail()
    const { emailVerifyToken } = valuesSpy.mock.calls[0]?.[0] as { emailVerifyToken: string }
    const verifyUrl = `${WEB_APP_URL}/auth/verify-email#token=${emailVerifyToken}`
    expect(response.status).toBe(201)
    expect(mail.to).toBe('user@example.com')
    expect(mail.subject).toBe('Confirmez votre adresse e-mail')
    expect(mail.html).toContain('<html lang="fr">')
    expect(mail.html).toContain(`href="${verifyUrl}"`)
    expect(mail.html).toContain('banner-account.png')
    expect(mail.text).toContain(`Confirmer mon adresse :\n${verifyUrl}`)
    expect(mail.text).toContain('Ce lien est valable 24 heures. Passé ce délai, il ne fonctionnera plus.')
    expect(mail.text).not.toContain('en demander un nouveau')
  })

  it('sends the verification email in the language of the request', async () => {
    mockRegistrationInserts()

    await postRegister({ 'Accept-Language': 'en-GB,en;q=0.9,fr;q=0.8' })

    const mail = await waitForSentMail()
    expect(mail.subject).toBe('Confirm your email address')
    expect(mail.text).toContain('This link is valid for 24 hours.')
  })

  it('falls back to French for a language the emails do not support', async () => {
    mockRegistrationInserts()

    await postRegister({ 'Accept-Language': 'de-DE' })

    expect((await waitForSentMail()).subject).toBe('Confirmez votre adresse e-mail')
  })

  it('still returns 201 when the provider fails, logging neither recipient nor link', async () => {
    mockRegistrationInserts()
    vi.mocked(sendMail).mockResolvedValueOnce({ isSuccess: false, reason: 'timeout' })
    const readLogs = spyOnAllLogLevels()

    const response = await postRegister()

    expect(response.status).toBe(201)
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith({
        event: 'auth_verification_email_failed',
        reason: 'timeout',
      })
    })
    expect(readLogs()).not.toContain('user@example.com')
    expect(readLogs()).not.toContain('verify-email')
  })

  it('does not send any email when the address is already taken', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)

    const response = await postRegister()

    await flushBackgroundWork()
    expect(response.status).toBe(409)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('returns 201 with user and refreshToken when registration is successful', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)
    mockInsertReturning(VALID_USER)
    mockInsertNoReturning()

    const response = await apiRequest('/v1/auth/register', {
      method: 'POST',
      body: {
        email: 'user@example.com',
        password: 'securepassword123',
        isCgvAccepted: true,
      },
    })

    const body = registerResponseSchema.parse(await response.json())
    expect(response.status).toBe(201)
    expect(body.user.email).toBe('user@example.com')
    expect(typeof body.refreshToken).toBe('string')
    expect(body.refreshToken.length).toBeGreaterThan(0)
  })

  it('persists defaultCurrencyCode when defaultCurrency is provided', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)
    const valuesSpy = vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([{ ...VALID_USER, defaultCurrencyCode: 'EUR' }]),
    })
    vi.mocked(db.insert).mockReturnValueOnce({ values: valuesSpy } as never)
    mockInsertNoReturning()

    const response = await apiRequest('/v1/auth/register', {
      method: 'POST',
      body: {
        email: 'user@example.com',
        password: 'securepassword123',
        defaultCurrency: 'EUR',
      },
    })

    const body = await response.json() as { user: { defaultCurrency: string } }
    expect(response.status).toBe(201)
    expect(body.user.defaultCurrency).toBe('EUR')
    const insertedRow = valuesSpy.mock.calls[0]?.[0] as { defaultCurrencyCode?: string }
    expect(insertedRow.defaultCurrencyCode).toBe('EUR')
  })

  it('falls back to the DB default (EUR) when defaultCurrency is omitted', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)
    const valuesSpy = vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([VALID_USER]),
    })
    vi.mocked(db.insert).mockReturnValueOnce({ values: valuesSpy } as never)
    mockInsertNoReturning()

    const response = await apiRequest('/v1/auth/register', {
      method: 'POST',
      body: {
        email: 'user@example.com',
        password: 'securepassword123',
      },
    })

    expect(response.status).toBe(201)
    const insertedRow = valuesSpy.mock.calls[0]?.[0] as { defaultCurrencyCode?: string }
    expect(insertedRow).not.toHaveProperty('defaultCurrencyCode')
    const body = await response.json() as { user: { defaultCurrency: string } }
    expect(body.user.defaultCurrency).toBe('EUR')
  })

  it('returns 422 when defaultCurrency is not a supported ISO code', async () => {
    const response = await apiRequest('/v1/auth/register', {
      method: 'POST',
      body: {
        email: 'user@example.com',
        password: 'securepassword123',
        defaultCurrency: 'XYZ',
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 409 when email already exists', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)

    const response = await apiRequest('/v1/auth/register', {
      method: 'POST',
      body: {
        email: 'user@example.com',
        password: 'securepassword123',
        isCgvAccepted: true,
      },
    })

    expect(response.status).toBe(409)
  })

  it('returns 422 when username contains invalid characters', async () => {
    const response = await apiRequest('/v1/auth/register', {
      method: 'POST',
      body: {
        email: 'user@example.com',
        password: 'securepassword123',
        isCgvAccepted: true,
        username: 'invalid username with spaces',
      },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when password is too short', async () => {
    const response = await apiRequest('/v1/auth/register', {
      method: 'POST',
      body: {
        email: 'user@example.com',
        password: 'short',
        isCgvAccepted: true,
      },
    })

    expect(response.status).toBe(422)
  })
})

describe('POST /v1/auth/verify-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 when token is valid', async () => {
    const validToken = '00000000-0000-0000-0000-000000000099'
    const userWithToken = {
      ...VALID_USER,
      emailVerifiedAt: null,
      emailVerifyToken: validToken,
      emailVerifyTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithToken)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([VALID_USER]),
        }),
      }),
    } as never)

    const response = await apiRequest('/v1/auth/verify-email', {
      method: 'POST',
      body: { token: validToken },
    })

    const body = verifyEmailResponseSchema.parse(await response.json())
    expect(response.status).toBe(200)
    expect(body.message).toBe('Email verified successfully')
  })

  it('counts the verification as an activity and derives the status from the row at write time', async () => {
    const validToken = '00000000-0000-0000-0000-000000000099'
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
      ...VALID_USER,
      emailVerifiedAt: null,
      userStatus: 'unverified' as const,
      lastActiveAt: new Date('2020-01-01'),
      emailVerifyToken: validToken,
      emailVerifyTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    const setSpy = vi.fn().mockReturnValueOnce({ where: vi.fn().mockResolvedValueOnce(undefined) })
    vi.mocked(db.update).mockReturnValueOnce({ set: setSpy } as never)

    await apiRequest('/v1/auth/verify-email', { method: 'POST', body: { token: validToken } })

    const stored = setSpy.mock.calls[0]?.[0] as { emailVerifiedAt: Date; lastActiveAt: Date; userStatus: SQL; emailVerifyToken: null }
    const status = new PgDialect().sqlToQuery(stored.userStatus)
    expect(stored.emailVerifiedAt).toBeInstanceOf(Date)
    expect(stored.lastActiveAt).toBe(stored.emailVerifiedAt)
    expect(stored.emailVerifyToken).toBeNull()
    expect(status.sql).toContain('"users"."deleted_at" IS NOT NULL')
    expect(status.params).toEqual(['pending_deletion', 'banned', 'invited', 'active'])
  })

  it('returns 400 when token is invalid', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest('/v1/auth/verify-email', {
      method: 'POST',
      body: { token: '00000000-0000-0000-0000-000000000000' },
    })

    expect(response.status).toBe(400)
  })

  it('returns 400 when token is expired', async () => {
    const expiredToken = '00000000-0000-0000-0000-000000000099'
    const userWithExpiredToken = {
      ...VALID_USER,
      emailVerifiedAt: null,
      emailVerifyToken: expiredToken,
      emailVerifyTokenExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
    }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithExpiredToken)

    const response = await apiRequest('/v1/auth/verify-email', {
      method: 'POST',
      body: { token: expiredToken },
    })

    expect(response.status).toBe(400)
  })

  it('returns 422 when token is not a valid uuid', async () => {
    const response = await apiRequest('/v1/auth/verify-email', {
      method: 'POST',
      body: { token: 'not-a-uuid' },
    })

    expect(response.status).toBe(422)
  })
})

describe('POST /v1/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with accessToken, refreshToken, and user when credentials are valid', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('securepassword123', 4)
    const userWithHash = { ...VALID_USER, passwordHash: hash }

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithHash)
    mockInsertNoReturning()

    const response = await apiRequest('/v1/auth/login', {
      method: 'POST',
      body: { email: 'user@example.com', password: 'securepassword123' },
    })

    const body = loginResponseSchema.parse(await response.json())
    expect(response.status).toBe(200)
    expect(body.user.createdAt).toEqual(VALID_USER.createdAt)
    expect(typeof body.accessToken).toBe('string')
    expect(typeof body.refreshToken).toBe('string')
    expect(body.refreshToken.length).toBeGreaterThan(0)
    expect(body.user.email).toBe('user@example.com')
  })

  it('bumps lastActiveAt on login and reactivates an inactive account in the same update', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('securepassword123', 4)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...VALID_USER, passwordHash: hash, userStatus: 'inactive' as const })
    mockInsertNoReturning()
    const setSpy = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as never)

    const response = await apiRequest('/v1/auth/login', {
      method: 'POST',
      body: { email: 'user@example.com', password: 'securepassword123' },
    })

    const stored = setSpy.mock.calls.map((call) => call[0] as { lastActiveAt?: Date; userStatus?: SQL })
    const activityWrite = stored.find((fields) => fields.lastActiveAt !== undefined)
    expect(response.status).toBe(200)
    expect(activityWrite?.lastActiveAt).toBeInstanceOf(Date)
    expect(activityWrite?.userStatus && new PgDialect().sqlToQuery(activityWrite.userStatus)).toMatchObject({
      sql: 'CASE WHEN "users"."user_status" = $1 THEN $2::user_status ELSE "users"."user_status" END',
      params: ['inactive', 'active'],
    })
  })

  it('returns the uploaded avatar with the user on login', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('securepassword123', 4)
    const avatarImage = {
      id: '00000000-0000-0000-0000-00000000e002',
      hash: 'f'.repeat(64),
      fileKey: 'ff/ff/' + 'f'.repeat(64),
      mime: 'image/png',
      sizeBytes: 4,
      width: 640,
      height: 480,
      uploadedBy: VALID_USER.id,
      createdAt: new Date('2024-05-01'),
      updatedAt: new Date('2024-05-01'),
    }

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
      ...VALID_USER,
      passwordHash: hash,
      avatarImageId: avatarImage.id,
      avatarImage,
    } as never)
    mockInsertNoReturning()

    const response = await apiRequest('/v1/auth/login', {
      method: 'POST',
      body: { email: 'user@example.com', password: 'securepassword123' },
    })

    const body = loginResponseSchema.parse(await response.json())
    expect(response.status).toBe(200)
    expect(body.user.avatar?.id).toBe(avatarImage.id)
    expect(body.user.avatar?.createdAt).toEqual(avatarImage.createdAt)
  })

  it('returns 422 with the SDK error envelope and metadata.issues when the body is invalid', async () => {
    const response = await apiRequest('/v1/auth/login', {
      method: 'POST',
      body: { email: 'not-an-email', password: '' },
    })

    const body = apiErrorBodySchema.parse(await response.json())
    const { issues } = validationErrorMetadataSchema.parse(body.metadata)
    expect(response.status).toBe(422)
    expect(body.code).toBe(ErrorCode.UNPROCESSABLE_ENTITY)
    expect(issues.map((issue) => issue.path)).toEqual(['email', 'password'])
  })

  it('returns 401 when email is unknown', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest('/v1/auth/login', {
      method: 'POST',
      body: { email: 'unknown@example.com', password: 'somepassword' },
    })

    expect(response.status).toBe(401)
  })

  it('returns 401 when password is incorrect', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('correctpassword', 4)
    const userWithHash = { ...VALID_USER, passwordHash: hash }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithHash)

    const response = await apiRequest('/v1/auth/login', {
      method: 'POST',
      body: { email: 'user@example.com', password: 'wrongpassword' },
    })

    expect(response.status).toBe(401)
  })

  it('returns 403 when email is not verified', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('securepassword123', 4)
    const unverifiedUser = { ...VALID_USER, passwordHash: hash, emailVerifiedAt: null }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(unverifiedUser)

    const response = await apiRequest('/v1/auth/login', {
      method: 'POST',
      body: { email: 'user@example.com', password: 'securepassword123' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 403 when account is banned', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.default.hash('securepassword123', 4)
    const bannedUser = { ...VALID_USER, passwordHash: hash, bannedAt: new Date('2024-01-01') }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(bannedUser)

    const response = await apiRequest('/v1/auth/login', {
      method: 'POST',
      body: { email: 'user@example.com', password: 'securepassword123' },
    })

    expect(response.status).toBe(403)
  })
})

describe('POST /v1/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with message and runs transaction when logout is successful', async () => {
    const token = await generateTestToken(VALID_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValueOnce(ACCESS_TOKEN_ENTRY)

    const response = await apiRequest('/v1/auth/logout', { method: 'POST', token })

    const body = logoutResponseSchema.parse(await response.json())
    expect(response.status).toBe(200)
    expect(body.message).toBe('Logged out successfully')
    expect(vi.mocked(db.transaction)).toHaveBeenCalledOnce()
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await apiRequest('/v1/auth/logout', { method: 'POST' })
    expect(response.status).toBe(401)
  })

  it('returns 401 when JWT is expired', async () => {
    const token = await generateTestToken(VALID_USER.id, { expired: true })

    const response = await apiRequest('/v1/auth/logout', { method: 'POST', token })

    expect(response.status).toBe(401)
  })

  it('returns 401 when JWT has no jti claim', async () => {
    const token = await generateTestToken(VALID_USER.id, { includeJti: false })

    const response = await apiRequest('/v1/auth/logout', { method: 'POST', token })

    expect(response.status).toBe(401)
  })

  it('returns 401 when token is not active', async () => {
    const token = await generateTestToken(VALID_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest('/v1/auth/logout', { method: 'POST', token })

    expect(response.status).toBe(401)
  })

  it('returns 500 when the logout transaction fails', async () => {
    const token = await generateTestToken(VALID_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValueOnce(ACCESS_TOKEN_ENTRY)
    vi.mocked(db.transaction).mockRejectedValueOnce(new Error('DB error'))

    const response = await apiRequest('/v1/auth/logout', { method: 'POST', token })

    expect(response.status).toBe(500)
  })

  it('revokes the refresh token when refreshToken is provided in the body', async () => {
    const token = await generateTestToken(VALID_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValueOnce(ACCESS_TOKEN_ENTRY)

    const txUpdate = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) }))
    const txDelete = vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) }))
    vi.mocked(db.transaction).mockImplementationOnce((async (callback: (tx: unknown) => Promise<unknown>) => {
      return callback({ delete: txDelete, update: txUpdate, insert: vi.fn() })
    }) as never)

    const response = await apiRequest('/v1/auth/logout', {
      method: 'POST',
      token,
      body: { refreshToken: 'some-refresh-token' },
    })

    expect(response.status).toBe(200)
    expect(txDelete).toHaveBeenCalledTimes(1)
    expect(txUpdate).toHaveBeenCalledTimes(2)
  })

  it('does not touch refresh_tokens when the body has no refreshToken', async () => {
    const token = await generateTestToken(VALID_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValueOnce(ACCESS_TOKEN_ENTRY)

    const txUpdate = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) }))
    const txDelete = vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) }))
    vi.mocked(db.transaction).mockImplementationOnce((async (callback: (tx: unknown) => Promise<unknown>) => {
      return callback({ delete: txDelete, update: txUpdate, insert: vi.fn() })
    }) as never)

    const response = await apiRequest('/v1/auth/logout', { method: 'POST', token })

    expect(response.status).toBe(200)
    expect(txDelete).toHaveBeenCalledTimes(1)
    expect(txUpdate).toHaveBeenCalledTimes(1)
  })

  it('returns 422 when refreshToken is an empty string', async () => {
    const token = await generateTestToken(VALID_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValueOnce(ACCESS_TOKEN_ENTRY)

    const response = await apiRequest('/v1/auth/logout', {
      method: 'POST',
      token,
      body: { refreshToken: '' },
    })

    expect(response.status).toBe(422)
  })
})

describe('POST /v1/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sendMail).mockResolvedValue(MAIL_SENT)
  })

  it('emails a web app reset link whose token hash is stored for 1 hour', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    const setSpy = mockPasswordResetUpdate()

    const before = Date.now()
    const response = await postForgotPassword('user@example.com')

    const body = (await response.json()) as { passwordResetToken: string }
    const mail = await waitForSentMail()
    const resetUrl = `${WEB_APP_URL}/auth/reset-password#token=${body.passwordResetToken}`
    const stored = setSpy.mock.calls[0]?.[0] as PasswordResetUpdate
    expect(mail.to).toBe('user@example.com')
    expect(mail.subject).toBe('Réinitialisez votre mot de passe Keimêlion')
    expect(mail.html).toContain(`href="${resetUrl}"`)
    expect(mail.text).toContain(`Choisir un nouveau mot de passe :\n${resetUrl}`)
    expect(mail.text).toContain("Ce lien est valable 1 heure et ne fonctionne qu'une seule fois.")
    expect(mail.text).toContain('vous pourrez en demander un nouveau avec « Mot de passe oublié »')
    expect(stored.passwordResetToken).toBe(hashSha256Hex(body.passwordResetToken))
    expect(stored.passwordResetTokenExpiresAt.getTime() - before).toBeGreaterThanOrEqual(ONE_HOUR_MS)
    expect(stored.passwordResetTokenExpiresAt.getTime() - before).toBeLessThan(ONE_HOUR_MS + ONE_MINUTE_MS)
  })

  it('sends the reset email in the language of the request', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    mockPasswordResetUpdate()

    await postForgotPassword('user@example.com', { 'Accept-Language': 'en' })

    const mail = await waitForSentMail()
    expect(mail.subject).toBe('Reset your Keimêlion password')
    expect(mail.text).toContain('This link is valid for 1 hour and can only be used once.')
  })

  it.each(['moderator', 'admin'] as const)('links a %s to the Backoffice reset-password page', async (role) => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...VALID_USER, role })
    mockPasswordResetUpdate()

    const response = await postForgotPassword('user@example.com')

    const body = (await response.json()) as { passwordResetToken: string }
    const mail = await waitForSentMail()
    expect(mail.html).toContain(`href="${BACKOFFICE_URL}/reset-password?token=${body.passwordResetToken}"`)
    expect(mail.text).not.toContain(WEB_APP_URL)
  })

  it('sends nothing and stores nothing for an unknown address, with the same response body', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await postForgotPassword('unknown@example.com')

    await flushBackgroundWork()
    expect(await response.json()).toEqual({ message: 'If this email is registered, a reset link has been sent' })
    expect(sendMail).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  it('answers the same in production whether or not the account exists', async () => {
    const originalEnv = env.NODE_ENV
    env.NODE_ENV = NodeEnvs.PRODUCTION
    try {
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
      mockPasswordResetUpdate()
      const known = await postForgotPassword('user@example.com')
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)
      const unknown = await postForgotPassword('unknown@example.com')

      expect(known.status).toBe(unknown.status)
      expect(await known.json()).toEqual(await unknown.json())
      await waitForSentMail()
    } finally {
      env.NODE_ENV = originalEnv
    }
  })

  it('keeps the token and the recipient out of the production logs', async () => {
    const originalEnv = env.NODE_ENV
    env.NODE_ENV = NodeEnvs.PRODUCTION
    const readLogs = spyOnAllLogLevels()
    try {
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
      const setSpy = mockPasswordResetUpdate()
      vi.mocked(sendMail).mockResolvedValueOnce({ isSuccess: false, reason: 'provider_error' })

      const response = await postForgotPassword('user@example.com')

      const emailedToken = /#token=([a-f0-9]+)/.exec((await waitForSentMail()).text)?.[1] ?? ''
      await vi.waitFor(() => {
        expect(logger.warn).toHaveBeenCalledWith({
          event: 'auth_password_reset_email_failed',
          reason: 'provider_error',
        })
      })
      const stored = setSpy.mock.calls[0]?.[0] as PasswordResetUpdate
      expect(response.status).toBe(200)
      expect(stored.passwordResetToken).toBe(hashSha256Hex(emailedToken))
      expect(readLogs()).not.toContain(emailedToken)
      expect(readLogs()).not.toContain('user@example.com')
    } finally {
      env.NODE_ENV = originalEnv
    }
  })

  it('still answers 200 when storing the token fails, and sends no link', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockRejectedValueOnce(new Error('connection lost')),
      }),
    } as never)
    const readLogs = spyOnAllLogLevels()

    const response = await postForgotPassword('user@example.com')

    expect(response.status).toBe(200)
    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith({
        event: 'auth_password_reset_failed',
        errorName: 'Error',
      })
    })
    expect(sendMail).not.toHaveBeenCalled()
    expect(readLogs()).not.toContain('connection lost')
  })

  it('returns 200 with generic message for a registered email user', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      }),
    } as never)

    const response = await apiRequest('/v1/auth/forgot-password', {
      method: 'POST',
      body: { email: 'user@example.com' },
    })

    const body = await response.json() as { message: string; passwordResetToken?: string }
    expect(response.status).toBe(200)
    expect(forgotPasswordResponseSchema.parse(body).message).toBe('If this email is registered, a reset link has been sent')
    expect(body.passwordResetToken).toMatch(/^[a-f0-9]{64}$/)
  })

  it('does not include passwordResetToken when the email is unknown', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest('/v1/auth/forgot-password', {
      method: 'POST',
      body: { email: 'unknown@example.com' },
    })

    const body = await response.json() as { message: string; passwordResetToken?: string }
    expect(response.status).toBe(200)
    expect(body.passwordResetToken).toBeUndefined()
  })

  it('does not leak passwordResetToken in production', async () => {
    const originalEnv = env.NODE_ENV
    env.NODE_ENV = NodeEnvs.PRODUCTION
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      }),
    } as never)

    try {
      const response = await apiRequest('/v1/auth/forgot-password', {
        method: 'POST',
        body: { email: 'user@example.com' },
      })

      const body = await response.json() as { message: string; passwordResetToken?: string }
      expect(response.status).toBe(200)
      expect(body.passwordResetToken).toBeUndefined()
    } finally {
      env.NODE_ENV = originalEnv
    }
  })

  it('returns 200 with generic message when email is unknown', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest('/v1/auth/forgot-password', {
      method: 'POST',
      body: { email: 'unknown@example.com' },
    })

    const body = await response.json() as { message: string }
    expect(response.status).toBe(200)
    expect(body.message).toBe('If this email is registered, a reset link has been sent')
  })

  it('returns 200 silently for an OAuth user with no password', async () => {
    const oauthUser = { ...VALID_USER, passwordHash: null }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(oauthUser)

    const response = await apiRequest('/v1/auth/forgot-password', {
      method: 'POST',
      body: { email: 'user@example.com' },
    })

    expect(response.status).toBe(200)
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
  })

  it('returns 422 when email is malformed', async () => {
    const response = await apiRequest('/v1/auth/forgot-password', {
      method: 'POST',
      body: { email: 'not-an-email' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when email is missing', async () => {
    const response = await apiRequest('/v1/auth/forgot-password', {
      method: 'POST',
      body: {},
    })

    expect(response.status).toBe(422)
  })
})

describe('POST /v1/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 and resets password when token is valid', async () => {
    const userWithResetToken = {
      ...VALID_USER,
      passwordResetToken: 'some-hash',
      passwordResetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithResetToken)
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never)
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    } as never)

    const response = await apiRequest('/v1/auth/reset-password', {
      method: 'POST',
      body: { passwordResetToken: 'valid-raw-token-64-chars-long-at-least-to-pass', password: 'newpassword123' },
    })

    const body = resetPasswordResponseSchema.parse(await response.json())
    expect(response.status).toBe(200)
    expect(body.message).toBe('Password reset successfully')
  })

  function mockResetPasswordWrites(): ReturnType<typeof vi.fn> {
    const setSpy = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as never)
    vi.mocked(db.delete).mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as never)
    return setSpy
  }

  function postResetPassword(): Promise<Response> {
    return apiRequest('/v1/auth/reset-password', {
      method: 'POST',
      body: { passwordResetToken: 'valid-raw-token-64-chars-long-at-least-to-pass', password: 'newpassword123' },
    })
  }

  it('activates a pending staff account on its first password, as an activity, keeping a concurrent ban', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
      ...VALID_USER,
      role: 'moderator' as const,
      activatedAt: null,
      userStatus: 'invited' as const,
      lastActiveAt: null,
      createdAt: new Date(),
      passwordResetToken: 'some-hash',
      passwordResetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    })
    const setSpy = mockResetPasswordWrites()

    const response = await postResetPassword()

    const stored = setSpy.mock.calls[0]?.[0] as { activatedAt: SQL; lastActiveAt: Date; userStatus: SQL; passwordResetToken: string | null }
    const dialect = new PgDialect()
    const status = dialect.sqlToQuery(stored.userStatus)
    expect(response.status).toBe(200)
    expect(stored.passwordResetToken).toBeNull()
    expect(stored.lastActiveAt).toBeInstanceOf(Date)
    expect(status.sql).toContain('"users"."banned_at" IS NOT NULL')
    expect(status.params).toEqual(['pending_deletion', 'banned', 'unverified', 'active'])
  })

  it('keeps the first activation date of an already activated account', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
      ...VALID_USER,
      activatedAt: new Date('2024-01-01'),
      passwordResetToken: 'some-hash',
      passwordResetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    })
    const setSpy = mockResetPasswordWrites()

    await postResetPassword()

    const stored = setSpy.mock.calls[0]?.[0] as { activatedAt: SQL }
    expect(new PgDialect().sqlToQuery(stored.activatedAt).sql).toBe('COALESCE("users"."activated_at", $1::timestamptz)')
  })

  it('returns 400 when token does not match any user', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest('/v1/auth/reset-password', {
      method: 'POST',
      body: { passwordResetToken: 'invalid-token', password: 'newpassword123' },
    })

    expect(response.status).toBe(400)
  })

  it('returns 400 when token is expired', async () => {
    const userWithExpiredToken = {
      ...VALID_USER,
      passwordResetToken: 'some-hash',
      passwordResetTokenExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
    }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithExpiredToken)

    const response = await apiRequest('/v1/auth/reset-password', {
      method: 'POST',
      body: { passwordResetToken: 'expired-token', password: 'newpassword123' },
    })

    expect(response.status).toBe(400)
  })

  it('returns 400 when user has no reset token set', async () => {
    const userWithNoToken = { ...VALID_USER, passwordResetToken: null, passwordResetTokenExpiresAt: null }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(userWithNoToken)

    const response = await apiRequest('/v1/auth/reset-password', {
      method: 'POST',
      body: { passwordResetToken: 'some-token', password: 'newpassword123' },
    })

    expect(response.status).toBe(400)
  })

  it('returns 422 when password is too short', async () => {
    const response = await apiRequest('/v1/auth/reset-password', {
      method: 'POST',
      body: { passwordResetToken: 'some-token', password: 'short' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when password is missing', async () => {
    const response = await apiRequest('/v1/auth/reset-password', {
      method: 'POST',
      body: { passwordResetToken: 'some-token' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when passwordResetToken is missing', async () => {
    const response = await apiRequest('/v1/auth/reset-password', {
      method: 'POST',
      body: { password: 'newpassword123' },
    })

    expect(response.status).toBe(422)
  })
})

describe('POST /v1/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with a new accessToken and a rotated refreshToken inside a single transaction', async () => {
    const submittedRefreshToken = 'some-valid-raw-token'
    vi.mocked(db.query.refreshTokens.findFirst).mockResolvedValueOnce(VALID_REFRESH_TOKEN_ROW)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(VALID_USER)

    const response = await apiRequest('/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: submittedRefreshToken },
    })

    const body = refreshResponseSchema.parse(await response.json())
    expect(response.status).toBe(200)
    expect(typeof body.accessToken).toBe('string')
    expect(body.accessToken.length).toBeGreaterThan(0)
    expect(body.refreshToken).not.toBe(submittedRefreshToken)
    expect(body.refreshToken).toMatch(/^[a-f0-9]{64}$/)
    expect(vi.mocked(db.transaction)).toHaveBeenCalledOnce()
  })

  it('returns 401 when refreshToken is not found', async () => {
    vi.mocked(db.query.refreshTokens.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest('/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: 'unknown-token' },
    })

    expect(response.status).toBe(401)
  })

  it('returns 401 when refreshToken is revoked', async () => {
    const revokedToken = { ...VALID_REFRESH_TOKEN_ROW, revokedAt: new Date('2024-01-01') }
    vi.mocked(db.query.refreshTokens.findFirst).mockResolvedValueOnce(revokedToken)

    const response = await apiRequest('/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: 'revoked-token' },
    })

    expect(response.status).toBe(401)
  })

  it('returns 401 when refreshToken is expired', async () => {
    const expiredToken = { ...VALID_REFRESH_TOKEN_ROW, expiresAt: new Date(Date.now() - 1000) }
    vi.mocked(db.query.refreshTokens.findFirst).mockResolvedValueOnce(expiredToken)

    const response = await apiRequest('/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: 'expired-token' },
    })

    expect(response.status).toBe(401)
  })

  it('returns 401 when user is soft-deleted', async () => {
    vi.mocked(db.query.refreshTokens.findFirst).mockResolvedValueOnce(VALID_REFRESH_TOKEN_ROW)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...VALID_USER, deletedAt: new Date('2024-01-01') })

    const response = await apiRequest('/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: 'some-token' },
    })

    expect(response.status).toBe(401)
  })

  it('returns 403 when user is banned', async () => {
    vi.mocked(db.query.refreshTokens.findFirst).mockResolvedValueOnce(VALID_REFRESH_TOKEN_ROW)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...VALID_USER, bannedAt: new Date('2024-01-01') })

    const response = await apiRequest('/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: 'some-token' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 422 when refreshToken field is missing', async () => {
    const response = await apiRequest('/v1/auth/refresh', {
      method: 'POST',
      body: {},
    })

    expect(response.status).toBe(422)
  })
})

describe('POST /v1/auth/register — multipart guards', () => {
  const UPLOAD_BODY_LIMIT_OVERFLOW_BYTES = 64 * 1024 + 1

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 413 PAYLOAD_TOO_LARGE when the multipart body exceeds the upload body limit', async () => {
    const oversized = Buffer.alloc(env.UPLOADS_MAX_SIZE_BYTES + UPLOAD_BODY_LIMIT_OVERFLOW_BYTES)

    const response = await apiMultipartRequest('/v1/auth/register', {
      method: 'POST',
      fields: { email: 'user@example.com', password: 'securepassword123' },
      image: { buffer: oversized },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(413)
    expect(body.code).toBe('PAYLOAD_TOO_LARGE')
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
  })

  it('returns 422 issues in the {path, message, code} shape for multipart bodies', async () => {
    const response = await apiMultipartRequest('/v1/auth/register', {
      method: 'POST',
      fields: { email: 'not-an-email', password: 'securepassword123' },
    })

    const body = await response.json() as { metadata: { issues: { path: string; message: string; code: string }[] } }
    expect(response.status).toBe(422)
    expect(body.metadata.issues[0]).toMatchObject({ path: 'email', code: 'invalid_format' })
    expect(typeof body.metadata.issues[0]?.message).toBe('string')
  })
})
