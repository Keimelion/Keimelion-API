import { createHash } from 'crypto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { ErrorCode, UserStatuses } from '@keimelion/sdk/enums'
import type { UserStatus } from '@keimelion/sdk/enums'
import { db } from '../../../db/client.js'
import { env } from '../../../config/env.js'
import { NodeEnvs } from '../../../shared/enums/node-env.js'
import { sendMail } from '../../../shared/mail/mail.sender.js'
import { apiRequest } from '../../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../../shared/test/auth.js'
import { ADMIN_USER_FIXTURE as ADMIN_USER, makeAdminUser } from '../../../shared/test/fixtures/users.js'
import { logger } from '../../../shared/utils/logger.js'
import { images } from '../../../db/entities/images/images.schema.js'
import { buildUserStatusCondition, deriveUserStatus } from './admin-users.status.js'
import type { UserStatusFields } from './admin-users.status.js'
import {
  adminUsersCreateResponseSchema,
  adminUsersGetResponseSchema,
  adminUsersListResponseSchema,
  adminUsersResendInvitationResponseSchema,
  adminUsersUpdateResponseSchema,
  messageResponseSchema,
} from '@keimelion/sdk/schemas'

vi.mock('../../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../../shared/mail/mail.sender.js', () => ({ sendMail: vi.fn() }))

const BACKOFFICE_URL = 'https://backoffice.keimelion.test'
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
const ONE_MINUTE_MS = 60 * 1000

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

async function waitForSentMail(): Promise<SentMail> {
  await vi.waitFor(() => {
    expect(sendMail).toHaveBeenCalledOnce()
  })
  return vi.mocked(sendMail).mock.calls[0]?.[0] as SentMail
}


const TARGET_USER = makeAdminUser({
  id: '00000000-0000-0000-0000-000000000002',
  email: 'user@example.com',
  username: 'regularuser',
  role: 'user',
  emailVerifiedAt: null,
})

const ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(ADMIN_USER.id)

function mockListUsers(rows: unknown[]): void {
  vi.mocked(db.query.users.findMany).mockResolvedValueOnce(rows as never)
}

function mockCountChain(total: number): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ count: total }]),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

function mockReservationCountsByUserIds(counts = new Map<string, number>()): void {
  const rows = Array.from(counts, ([userId, total]) => ({ userId, total }))
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockResolvedValueOnce(rows),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

function mockPendingReportImageGuardSubquery(): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

function mockReservationCountForUser(total = 0): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ count: total }]),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

describe('GET /v1/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('returns 200 with paginated users list when admin is authenticated', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([ADMIN_USER, TARGET_USER])
    mockCountChain(2)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users', { token })

    const body = await response.json() as { items: { email: string }[]; pagination: { total: number } }
    adminUsersListResponseSchema.parse(body)
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(2)
    expect(body.items[0]?.email).toBe('admin@example.com')
    expect(body.pagination.total).toBe(2)
  })

  it('populates avatar.urls on rows whose avatarImage JOIN is attached', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    const avatarImageRow = {
      id: '00000000-0000-0000-0000-0000000000a1',
      hash: 'abc123',
      fileKey: 'ab/c1/abc123',
      mime: 'image/jpeg',
      sizeBytes: 1024,
      width: 300,
      height: 300,
      uploadedBy: TARGET_USER.id,
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01'),
    }
    const userWithAvatar = { ...TARGET_USER, avatarImageId: avatarImageRow.id, avatarImage: avatarImageRow }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([userWithAvatar])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users', { token })

    const body = await response.json() as {
      items: { avatar: { urls: { sm: string; md: string; lg: string } } | null }[]
    }
    expect(response.status).toBe(200)
    expect(body.items[0]?.avatar).not.toBeNull()
    expect(body.items[0]?.avatar?.urls.sm).toContain('ab/c1/abc123-300.webp')
    expect(body.items[0]?.avatar?.urls.md).toContain('ab/c1/abc123-800.webp')
    expect(body.items[0]?.avatar?.urls.lg).toContain('ab/c1/abc123-1600.webp')
  })

  it('hides soft-deleted users by default', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([ADMIN_USER])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users', { token })

    const body = await response.json() as { items: unknown[]; pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })

  it('returns soft-deleted users when deletedAt[isNull]=false', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    const deletedUser = { ...TARGET_USER, deletedAt: new Date('2024-06-01') }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([deletedUser])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users?deletedAt%5BisNull%5D=false', { token })

    const body = await response.json() as { items: { deletedAt: string | null }[] }
    expect(response.status).toBe(200)
    expect(body.items[0]?.deletedAt).not.toBeNull()
  })

  it('returns empty result set when no users match filters', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([])
    mockCountChain(0)

    const response = await apiRequest('/v1/admin/users?email%5Bilike%5D=nomatch', { token })

    const body = await response.json() as { items: unknown[]; pagination: { total: number; totalPages: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
    expect(body.pagination.totalPages).toBe(0)
  })

  it('filters by role[eq]=admin', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([ADMIN_USER])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users?role%5Beq%5D=admin', { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { pagination: { total: number } }
    expect(body.pagination.total).toBe(1)
  })

  it('filters by bannedAt[isNull]=false returns only banned users', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    const bannedUser = { ...TARGET_USER, bannedAt: new Date('2024-03-01') }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([bannedUser])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users?bannedAt%5BisNull%5D=false', { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { items: { bannedAt: string | null }[] }
    expect(body.items[0]?.bannedAt).not.toBeNull()
  })

  it('filters by bannedAt[isNull]=true returns only non-banned users', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([ADMIN_USER, TARGET_USER])
    mockCountChain(2)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users?bannedAt%5BisNull%5D=true', { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { items: { bannedAt: string | null }[] }
    expect(body.items.every((item) => item.bannedAt === null)).toBe(true)
  })

  it('applies createdAt[gte] and createdAt[lte] date filters', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([ADMIN_USER])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest(
      '/v1/admin/users?createdAt%5Bgte%5D=2024-01-01T00:00:00Z&createdAt%5Blte%5D=2024-12-31T23:59:59Z',
      { token },
    )

    expect(response.status).toBe(200)
  })

  it('applies sort param and returns 200', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([ADMIN_USER, TARGET_USER])
    mockCountChain(2)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users?sort=email:asc', { token })

    expect(response.status).toBe(200)
  })

  it('applies sort=username:asc and returns 200', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([ADMIN_USER, TARGET_USER])
    mockCountChain(2)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users?sort=username:asc', { token })

    expect(response.status).toBe(200)
  })

  it('applies combined filters', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([ADMIN_USER])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest(
      '/v1/admin/users?role%5Beq%5D=admin&bannedAt%5BisNull%5D=true&sort=email:asc&page=1&limit=50',
      { token },
    )

    expect(response.status).toBe(200)
    const body = await response.json() as { pagination: { page: number; limit: number } }
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.limit).toBe(50)
  })

  it('total reflects filtered count (regression guard)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([ADMIN_USER])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users?role%5Beq%5D=admin', { token })

    const body = await response.json() as { pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.pagination.total).toBe(1)
  })

  it('sensitive fields are never present in admin user response', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([ADMIN_USER])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users', { token })

    const body = await response.json() as { items: Record<string, unknown>[] }
    expect(response.status).toBe(200)
    const item = body.items[0]
    expect(item).not.toHaveProperty('passwordHash')
    expect(item).not.toHaveProperty('emailVerifyToken')
    expect(item).not.toHaveProperty('emailVerifyTokenExpiresAt')
    expect(item).not.toHaveProperty('passwordResetToken')
    expect(item).not.toHaveProperty('passwordResetTokenExpiresAt')
  })

  it('returns 422 when page is less than 1', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?page=0', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when limit exceeds 100', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?limit=101', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when page is not an integer', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?page=1.5', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when sort field is not in whitelist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?sort=passwordHash:asc', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when sort is missing direction', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?sort=createdAt', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when sort direction is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?sort=createdAt:sideways', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when bracket isNull value is not "true" or "false"', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?bannedAt%5BisNull%5D=maybe', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when bracket "in" is used with a scalar value', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?role%5Bin%5D=admin', { token })

    expect(response.status).toBe(422)
  })

  it('accepts bracket-syntax filter email[ilike] and returns 200', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([ADMIN_USER])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users?email%5Bilike%5D=admin', { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { items: { email: string }[] }
    expect(body.items[0]?.email).toBe('admin@example.com')
  })

  it('accepts bracket-syntax id[eq] and returns 200', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([TARGET_USER])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest(`/v1/admin/users?id%5Beq%5D=${TARGET_USER.id}`, { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { items: { id: string }[] }
    expect(body.items[0]?.id).toBe(TARGET_USER.id)
  })

  it('accepts bracket-syntax username[ilike] and returns 200', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([TARGET_USER])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users?username%5Bilike%5D=regular', { token })

    expect(response.status).toBe(200)
    const body = await response.json() as { items: { username: string }[] }
    expect(body.items[0]?.username).toBe('regularuser')
  })

  it('accepts bracket-syntax bannedAt[isNull]=true and returns 200', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([TARGET_USER])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users?bannedAt%5BisNull%5D=true', { token })

    expect(response.status).toBe(200)
  })

  it('accepts multiple bracket filters combined and returns 200', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([ADMIN_USER])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users?role%5Beq%5D=admin&email%5Bilike%5D=admin', { token })

    expect(response.status).toBe(200)
  })

  it('returns 422 when bracket-syntax uses a disallowed operator for the field', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?email%5Bgte%5D=foo', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when role[eq] value is not a known role', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?role%5Beq%5D=superuser', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when role[in] contains an unknown role', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest(
      '/v1/admin/users?role%5Bin%5D%5B%5D=admin&role%5Bin%5D%5B%5D=superuser',
      { token },
    )

    expect(response.status).toBe(422)
  })

  it('returns 422 when createdAt[gte] is not a valid ISO date', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?createdAt%5Bgte%5D=not-a-date', { token })

    expect(response.status).toBe(422)
  })

  it('returns 422 when bracket-syntax uses an unknown field', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?passwordHash%5Beq%5D=anything', { token })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(TARGET_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)

    const response = await apiRequest('/v1/admin/users', { token })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await apiRequest('/v1/admin/users')
    expect(response.status).toBe(401)
  })

  it('returns 401 when JWT is invalid', async () => {
    const response = await apiRequest('/v1/admin/users', { token: 'invalidtoken' })
    expect(response.status).toBe(401)
  })
})

describe('GET /v1/admin/users/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('returns 200 with admin user when id is valid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)
    mockReservationCountForUser()

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { token })

    const body = await response.json() as { user: { email: string; reservationsCount: number } }
    adminUsersGetResponseSchema.parse(body)
    expect(response.status).toBe(200)
    expect(body.user.email).toBe('user@example.com')
    expect(body.user.reservationsCount).toBe(0)
  })

  it('includes a reservationsCount matching the user tally', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)
    mockReservationCountForUser(3)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { token })

    const body = await response.json() as { user: { reservationsCount: number } }
    expect(response.status).toBe(200)
    expect(body.user.reservationsCount).toBe(3)
  })

  it('returns 200 including soft-deleted user', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    const deletedUser = { ...TARGET_USER, deletedAt: new Date('2024-06-01') }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(deletedUser)
    mockReservationCountForUser()

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { token })

    const body = await response.json() as { user: { deletedAt: string | null } }
    expect(response.status).toBe(200)
    expect(body.user.deletedAt).not.toBeNull()
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users/not-a-uuid', { token })

    expect(response.status).toBe(422)
  })

  it('returns 404 when user is not found', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { token })

    expect(response.status).toBe(404)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(TARGET_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { token })

    expect(response.status).toBe(403)
  })
})

describe('PATCH /v1/admin/users/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('returns 200 with updated user when body is valid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    const updatedUser = { ...TARGET_USER, role: 'moderator' as const }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)
    vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
      const tx = {
        update: vi.fn().mockReturnValueOnce({
          set: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              returning: vi.fn().mockResolvedValueOnce([updatedUser]),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }
      return callback(tx as never)
    })
    mockReservationCountForUser()

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { role: 'moderator' },
    })

    const body = await response.json() as { user: { role: string } }
    adminUsersUpdateResponseSchema.parse(body)
    expect(response.status).toBe(200)
    expect(body.user.role).toBe('moderator')
  })

  it('returns 422 when avatarUrl is sent (avatars are upload-only)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { avatarUrl: 'https://example.com/avatar.png' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when role is not a valid enum value', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { role: 'superuser' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 404 when target user is not found', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { role: 'moderator' },
    })

    expect(response.status).toBe(404)
  })

  it('returns 403 when admin tries to update themselves', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest(`/v1/admin/users/${ADMIN_USER.id}`, {
      method: 'PATCH',
      token,
      body: { clearAvatar: true },
    })

    expect(response.status).toBe(403)
  })

  it('returns 500 when update query returns empty result', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)
    vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
      const tx = {
        update: vi.fn().mockReturnValueOnce({
          set: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              returning: vi.fn().mockResolvedValueOnce([]),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }
      return callback(tx as never)
    })

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { role: 'moderator' },
    })

    expect(response.status).toBe(500)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(TARGET_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { role: 'moderator' },
    })

    expect(response.status).toBe(403)
  })

  it('silently strips password fields from the body — password is never touched', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    const updatedUser = { ...TARGET_USER, role: 'moderator' as const }
    const setMock = vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([updatedUser]),
      }),
    })

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)
    vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
      const tx = {
        update: vi.fn().mockReturnValueOnce({ set: setMock }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }
      return callback(tx as never)
    })
    mockReservationCountForUser()

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: {
        role: 'moderator',
        password: 'evil-plaintext',
        passwordHash: 'evil-hash',
        email: 'takeover@example.com',
        bannedAt: null,
      },
    })

    expect(response.status).toBe(200)
    expect(setMock).toHaveBeenCalledOnce()
    const setArgs = setMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArgs).not.toHaveProperty('password')
    expect(setArgs).not.toHaveProperty('passwordHash')
    expect(setArgs).not.toHaveProperty('email')
    expect(setArgs).not.toHaveProperty('bannedAt')
  })

  it('revokes both token types when role changes', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    const updatedUser = { ...TARGET_USER, role: 'moderator' as const }
    let capturedTx: { delete: ReturnType<typeof vi.fn> } | undefined

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)
    vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
      const tx = {
        update: vi.fn().mockReturnValueOnce({
          set: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              returning: vi.fn().mockResolvedValueOnce([updatedUser]),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }
      capturedTx = tx
      return callback(tx as never)
    })
    mockReservationCountForUser()

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { role: 'moderator' },
    })

    expect(response.status).toBe(200)
    expect(capturedTx?.delete).toHaveBeenCalledTimes(2)
  })

  it('skips token revocation when provided role equals current role', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    const sameRoleUser = { ...TARGET_USER, role: 'user' as const }
    let capturedTx: { delete: ReturnType<typeof vi.fn> } | undefined

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)
    vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
      const tx = {
        update: vi.fn().mockReturnValueOnce({
          set: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              returning: vi.fn().mockResolvedValueOnce([sameRoleUser]),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }
      capturedTx = tx
      return callback(tx as never)
    })
    mockReservationCountForUser()

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { role: 'user' },
    })

    expect(response.status).toBe(200)
    expect(capturedTx?.delete).not.toHaveBeenCalled()
  })

  it('clears the avatar with clearAvatar=true and deletes the previous images row', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    const previousImageId = '00000000-0000-0000-0000-00000000d000'
    const set = vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([{ ...TARGET_USER, avatarImageId: null }]),
      }),
    })

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...TARGET_USER, avatarImageId: previousImageId })
    vi.mocked(db.transaction).mockImplementationOnce(async (callback) => callback({ update: vi.fn(() => ({ set })) } as never))
    mockPendingReportImageGuardSubquery()
    mockReservationCountForUser()

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { clearAvatar: true },
    })

    expect(response.status).toBe(200)
    expect(set).toHaveBeenCalledWith({ avatarImageId: null })
    expect(vi.mocked(db.delete)).toHaveBeenCalledWith(images)
  })

  it('skips token revocation when update does not include role', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    const updatedUser = { ...TARGET_USER, isMarketingOptedIn: true }
    let capturedTx: { delete: ReturnType<typeof vi.fn> } | undefined

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)
    vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
      const tx = {
        update: vi.fn().mockReturnValueOnce({
          set: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              returning: vi.fn().mockResolvedValueOnce([updatedUser]),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }
      capturedTx = tx
      return callback(tx as never)
    })
    mockReservationCountForUser()

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, {
      method: 'PATCH',
      token,
      body: { isMarketingOptedIn: true },
    })

    expect(response.status).toBe(200)
    expect(capturedTx?.delete).not.toHaveBeenCalled()
  })
})

describe('DELETE /v1/admin/users/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('returns 200 and soft-deletes the user', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    const deletedUser = { ...TARGET_USER, deletedAt: new Date() }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([deletedUser]),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { method: 'DELETE', token })

    const body = await response.json() as { message: string }
    messageResponseSchema.parse(body)
    expect(response.status).toBe(200)
    expect(body.message).toBe('User deleted successfully')
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users/not-a-uuid', { method: 'DELETE', token })

    expect(response.status).toBe(422)
  })

  it('returns 404 when target user is not found', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { method: 'DELETE', token })

    expect(response.status).toBe(404)
  })

  it('returns 403 when admin tries to delete themselves', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest(`/v1/admin/users/${ADMIN_USER.id}`, { method: 'DELETE', token })

    expect(response.status).toBe(403)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(TARGET_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)

    const response = await apiRequest(`/v1/admin/users/${TARGET_USER.id}`, { method: 'DELETE', token })

    expect(response.status).toBe(403)
  })
})

describe('POST /v1/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
    vi.mocked(sendMail).mockResolvedValue({ isSuccess: true, messageId: 'message-1' })
  })

  function mockInsertUser(): void {
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([TARGET_USER]),
      }),
    } as never)
  }

  it('returns 401 when no authorization header is provided', async () => {
    const response = await apiRequest('/v1/admin/users', { method: 'POST', body: { email: 'new@example.com', role: 'moderator' } })
    expect(response.status).toBe(401)
  })

  it('returns 403 when user does not have admin role', async () => {
    const token = await generateTestToken(TARGET_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'user' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 422 when role is missing', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when role is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'superuser' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when email is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'not-an-email', role: 'moderator' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when username does not match the regex', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', username: 'bad username!', role: 'moderator' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when an unknown key is provided (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'moderator', unknownField: 'value' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when password key is provided (strict schema rejects it)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'moderator', password: 'somepassword' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 201 with user and passwordResetToken in non-production', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockInsertUser()

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'moderator' },
    })

    const body = await response.json() as { user: Record<string, unknown>; passwordResetToken: string }
    adminUsersCreateResponseSchema.parse(body)
    expect(response.status).toBe(201)
    expect(body.user).toBeDefined()
    expect(body.user.email).toBe('user@example.com')
    expect(body.passwordResetToken).toBeDefined()
    expect(typeof body.passwordResetToken).toBe('string')
  })

  it('response body does not expose sensitive fields', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockInsertUser()

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'moderator' },
    })

    const body = await response.json() as { user: Record<string, unknown> }
    expect(response.status).toBe(201)
    expect(body.user).not.toHaveProperty('passwordHash')
    expect(body.user).not.toHaveProperty('passwordResetToken')
    expect(body.user).not.toHaveProperty('emailVerifyToken')
  })

  it('logs at warn level for privileged role (moderator)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockInsertUser()

    await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'moderator' },
    })

    expect(vi.mocked(logger.warn)).toHaveBeenCalledOnce()
    expect(vi.mocked(logger.info)).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_create_user' }),
    )
  })

  it('logs at warn level for privileged role (admin)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockInsertUser()

    await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'admin' },
    })

    expect(vi.mocked(logger.warn)).toHaveBeenCalledOnce()
  })

  it('returns 422 on the role when it is user: regular users only come from public registration', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'user' },
    })

    const body = (await response.json()) as ValidationErrorBody
    expect(response.status).toBe(422)
    expect(body.code).toBe(ErrorCode.UNPROCESSABLE_ENTITY)
    expect(body.metadata.issues.map((issue) => issue.path)).toEqual(['role'])
    expect(db.insert).not.toHaveBeenCalled()
    expect(sendMail).not.toHaveBeenCalled()
  })

  it.each([
    ['moderator', 'modérateur'],
    ['admin', 'administrateur'],
  ] as const)('sends the %s a French staff invitation with the Backoffice set-password link', async (role, roleLabel) => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockInsertUser()

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role },
    })

    const body = (await response.json()) as { passwordResetToken: string }
    const mail = await waitForSentMail()
    const setPasswordUrl = `${BACKOFFICE_URL}/reset-password?token=${body.passwordResetToken}`
    expect(response.status).toBe(201)
    expect(mail.to).toBe('new@example.com')
    expect(mail.subject).toBe('Votre accès au Backoffice Keimêlion')
    expect(mail.html).toContain('<html lang="fr">')
    expect(mail.html).toContain(`<strong>${roleLabel}</strong>`)
    expect(mail.html).toContain(`href="${setPasswordUrl}"`)
    expect(mail.html).toContain('banner-staff.png')
    expect(mail.text).toContain(
      `un compte ${roleLabel} sur le Backoffice, avec l'adresse new@example.com.`,
    )
    expect(mail.text).toContain(`Définir mon mot de passe :\n${setPasswordUrl}`)
    expect(mail.text).toContain("Ce lien est valable 24 heures et ne fonctionne qu'une seule fois.")
  })

  it('stores the hash of the emailed token, valid 24 hours', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    const valuesMock = vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([TARGET_USER]),
    })
    vi.mocked(db.insert).mockReturnValueOnce({ values: valuesMock } as never)

    const before = Date.now()
    await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'moderator' },
    })

    const emailedToken = /\?token=([a-f0-9]+)/.exec((await waitForSentMail()).text)?.[1] ?? ''
    const inserted = valuesMock.mock.calls[0]?.[0] as { passwordResetToken: string; passwordResetTokenExpiresAt: Date }
    expect(inserted.passwordResetToken).toBe(createHash('sha256').update(emailedToken).digest('hex'))
    expect(inserted.passwordResetTokenExpiresAt.getTime() - before).toBeGreaterThanOrEqual(TWENTY_FOUR_HOURS_MS)
    expect(inserted.passwordResetTokenExpiresAt.getTime() - before).toBeLessThan(TWENTY_FOUR_HOURS_MS + ONE_MINUTE_MS)
  })

  it('still returns 201 when the provider fails, logging neither recipient nor link', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockInsertUser()
    vi.mocked(sendMail).mockResolvedValueOnce({ isSuccess: false, reason: 'provider_error' })

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'moderator' },
    })

    expect(response.status).toBe(201)
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith({
        event: 'admin_staff_invitation_email_failed',
        reason: 'provider_error',
      })
    })
  })

  it('logs neither the token nor the recipient address in production', async () => {
    const originalNodeEnv = env.NODE_ENV
    env.NODE_ENV = NodeEnvs.PRODUCTION
    try {
      const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
      mockInsertUser()

      const response = await apiRequest('/v1/admin/users', {
        method: 'POST',
        token,
        body: { email: 'new@example.com', role: 'moderator' },
      })

      const body = (await response.json()) as { passwordResetToken?: string }
      const emailedToken = /\?token=([a-f0-9]+)/.exec((await waitForSentMail()).text)?.[1] ?? ''
      const logs = JSON.stringify([
        vi.mocked(logger.info).mock.calls,
        vi.mocked(logger.warn).mock.calls,
        vi.mocked(logger.error).mock.calls,
      ])
      expect(body.passwordResetToken).toBeUndefined()
      expect(emailedToken).not.toBe('')
      expect(logs).not.toContain(emailedToken)
      expect(logs).not.toContain('new@example.com')
    } finally {
      env.NODE_ENV = originalNodeEnv
    }
  })

  it('calls db.insert with expected explicit values', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const valuesMock = vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([TARGET_USER]),
    })
    vi.mocked(db.insert).mockReturnValueOnce({ values: valuesMock } as never)

    await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'moderator' },
    })

    expect(valuesMock).toHaveBeenCalledOnce()
    const insertedFields = valuesMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(insertedFields.isCgvAccepted).toBe(false)
    expect(insertedFields.isMarketingOptedIn).toBe(false)
    expect(insertedFields.cgvAcceptedAt).toBeNull()
    expect(insertedFields.emailVerifyToken).toBeNull()
    expect(insertedFields.emailVerifyTokenExpiresAt).toBeNull()
    expect(insertedFields.emailVerifiedAt).toBeInstanceOf(Date)
    expect(insertedFields.authProvider).toBe('email')
    expect(insertedFields.passwordResetToken).toBeDefined()
    expect(insertedFields.passwordResetTokenExpiresAt).toBeInstanceOf(Date)
    expect(insertedFields.activatedAt).toBeNull()
  })

  it('returns 409 when insert hits the unique constraint', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    class PgUniqueError extends Error {
      code = '23505'
    }

    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockRejectedValueOnce(new PgUniqueError('unique violation')),
      }),
    } as never)

    const response = await apiRequest('/v1/admin/users', {
      method: 'POST',
      token,
      body: { email: 'new@example.com', role: 'moderator' },
    })

    expect(response.status).toBe(409)
    expect(sendMail).not.toHaveBeenCalled()
  })
})

const NOW = new Date('2026-11-16T12:00:00Z')
const ELEVEN_MONTHS_AGO = new Date('2025-12-16T12:00:00Z')
const THIRTEEN_MONTHS_AGO = new Date('2025-10-16T12:00:00Z')

const ACTIVE_FIELDS: UserStatusFields = {
  deletedAt: null,
  bannedAt: null,
  activatedAt: ELEVEN_MONTHS_AGO,
  emailVerifiedAt: ELEVEN_MONTHS_AGO,
  lastActiveAt: ELEVEN_MONTHS_AGO,
  createdAt: THIRTEEN_MONTHS_AGO,
}

function renderSql(condition: SQL | undefined): string {
  if (!condition) return ''
  return new PgDialect().sqlToQuery(condition).sql
}

function lastFindManyWhere(): SQL {
  const options = vi.mocked(db.query.users.findMany).mock.calls[0]?.[0] as { where: SQL }
  return options.where
}

describe('deriveUserStatus', () => {
  it.each<[string, Partial<UserStatusFields>, UserStatus]>([
    ['a soft-deleted account, whatever else it matches', { deletedAt: NOW, bannedAt: NOW, activatedAt: null }, UserStatuses.PENDING_DELETION],
    ['a banned account still pending its invitation', { bannedAt: NOW, activatedAt: null }, UserStatuses.BANNED],
    ['a staff account that never set a password', { activatedAt: null, emailVerifiedAt: null, lastActiveAt: null }, UserStatuses.INVITED],
    ['an activated account with an unverified email', { emailVerifiedAt: null, lastActiveAt: THIRTEEN_MONTHS_AGO }, UserStatuses.UNVERIFIED],
    ['an account last active more than 12 months ago', { lastActiveAt: THIRTEEN_MONTHS_AGO }, UserStatuses.INACTIVE],
    ['an account never active, created more than 12 months ago', { lastActiveAt: null }, UserStatuses.INACTIVE],
    ['an account never active, created less than 12 months ago', { lastActiveAt: null, createdAt: ELEVEN_MONTHS_AGO }, UserStatuses.ACTIVE],
    ['an account active within the last 12 months', {}, UserStatuses.ACTIVE],
  ])('reports %s', (_label, overrides, expected) => {
    expect(deriveUserStatus({ ...ACTIVE_FIELDS, ...overrides }, NOW)).toBe(expected)
  })
})

describe('buildUserStatusCondition', () => {
  const DELETED = '"users"."deleted_at" is not null'
  const BANNED = '"users"."banned_at" is not null'
  const INVITED = '"users"."activated_at" is null'
  const UNVERIFIED = '"users"."email_verified_at" is null'
  const INACTIVE = 'COALESCE("users"."last_active_at", "users"."created_at") < now() - make_interval(months => $1)'

  it.each<[UserStatus, string]>([
    [UserStatuses.PENDING_DELETION, DELETED],
    [UserStatuses.BANNED, `(not ${DELETED} and ${BANNED})`],
    [UserStatuses.INVITED, `(not ${DELETED} and not ${BANNED} and ${INVITED})`],
    [UserStatuses.UNVERIFIED, `(not ${DELETED} and not ${BANNED} and not ${INVITED} and ${UNVERIFIED})`],
    [UserStatuses.INACTIVE, `(not ${DELETED} and not ${BANNED} and not ${INVITED} and not ${UNVERIFIED} and ${INACTIVE})`],
    [UserStatuses.ACTIVE, `(not ${DELETED} and not ${BANNED} and not ${INVITED} and not ${UNVERIFIED} and not ${INACTIVE})`],
  ])('matches %s only when no higher-precedence status applies', (status, expectedSql) => {
    expect(renderSql(buildUserStatusCondition(status))).toBe(expectedSql)
  })

  it('uses the 12-month inactivity threshold', () => {
    const condition = buildUserStatusCondition(UserStatuses.INACTIVE)

    expect(condition && new PgDialect().sqlToQuery(condition).params).toEqual([12])
  })
})

describe('GET /v1/admin/users — derived status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
  })

  it('exposes activatedAt and the derived status on each user', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    const invitedStaff = makeAdminUser({ id: '00000000-0000-0000-0000-000000000003', role: 'moderator', activatedAt: null })
    const bannedUser = { ...TARGET_USER, bannedAt: new Date('2024-06-01') }
    const activeAdmin = { ...ADMIN_USER, lastActiveAt: new Date() }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([invitedStaff, bannedUser, activeAdmin])
    mockCountChain(3)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users', { token })

    const body = adminUsersListResponseSchema.parse(await response.json())
    expect(response.status).toBe(200)
    expect(body.items.map((user) => user.status)).toEqual(['invited', 'banned', 'active'])
    expect(body.items[0]?.activatedAt).toBeNull()
    expect(body.items[2]?.activatedAt).toEqual(new Date('2024-01-01'))
  })

  it('filters by status with the same precedence as the derived status', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([])
    mockCountChain(0)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users?status=invited', { token })

    expect(response.status).toBe(200)
    expect(renderSql(lastFindManyWhere())).toBe(renderSql(buildUserStatusCondition(UserStatuses.INVITED)))
  })

  it('lists soft-deleted users for status=pending_deletion instead of hiding them by default', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    const deletedUser = { ...TARGET_USER, deletedAt: new Date('2024-06-01') }
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([deletedUser])
    mockCountChain(1)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users?status=pending_deletion', { token })

    const body = adminUsersListResponseSchema.parse(await response.json())
    expect(response.status).toBe(200)
    expect(body.items[0]?.status).toBe('pending_deletion')
    expect(renderSql(lastFindManyWhere())).toBe('"users"."deleted_at" is not null')
  })

  it('combines the status filter with bracket filters', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    mockListUsers([])
    mockCountChain(0)
    mockReservationCountsByUserIds()

    const response = await apiRequest('/v1/admin/users?status=active&role[eq]=moderator', { token })

    const whereSql = renderSql(lastFindManyWhere())
    expect(response.status).toBe(200)
    expect(whereSql).toContain(renderSql(buildUserStatusCondition(UserStatuses.ACTIVE)))
    expect(whereSql).toContain('"users"."role" = $')
  })

  it('returns 422 when status is not a known status', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await apiRequest('/v1/admin/users?status=deleted', { token })

    const body = await response.json() as ValidationErrorBody
    expect(response.status).toBe(422)
    expect(body.metadata.issues.map((issue) => issue.path)).toEqual(['status'])
    expect(db.query.users.findMany).not.toHaveBeenCalled()
  })
})

describe('POST /v1/admin/users/:id/resend-invitation', () => {
  const PENDING_STAFF = {
    ...makeAdminUser({
      id: '00000000-0000-0000-0000-000000000003',
      email: 'staff@example.com',
      username: 'pendingstaff',
      role: 'moderator',
      activatedAt: null,
      passwordResetToken: 'previous-token-hash',
      passwordResetTokenExpiresAt: new Date('2024-01-02'),
    }),
    avatarImage: null,
  }
  const RESEND_PATH = `/v1/admin/users/${PENDING_STAFF.id}/resend-invitation`

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY)
    vi.mocked(sendMail).mockResolvedValue({ isSuccess: true, messageId: 'message-1' })
  })

  function mockTargetUser(target: unknown): void {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(target as never)
  }

  function mockTokenRenewal(renewedRows: unknown[]): { set: ReturnType<typeof vi.fn>; where: ReturnType<typeof vi.fn> } {
    const where = vi.fn().mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce(renewedRows) })
    const set = vi.fn().mockReturnValueOnce({ where })
    vi.mocked(db.update).mockReturnValueOnce({ set } as never)
    return { set, where }
  }

  function mockSuccessfulRenewal(): { set: ReturnType<typeof vi.fn>; where: ReturnType<typeof vi.fn> } {
    mockTargetUser(PENDING_STAFF)
    const renewal = mockTokenRenewal([{ ...PENDING_STAFF, passwordResetToken: 'new-token-hash' }])
    mockReservationCountForUser()
    return renewal
  }

  async function postResend(path = RESEND_PATH): Promise<Response> {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    return apiRequest(path, { method: 'POST', token })
  }

  it('returns 200 with the invited user and sends the staff invitation with a new Backoffice link', async () => {
    mockSuccessfulRenewal()

    const response = await postResend()

    const rawBody = await response.json() as { passwordResetToken: string }
    const body = adminUsersResendInvitationResponseSchema.parse(rawBody)
    const mail = await waitForSentMail()
    const setPasswordUrl = `${BACKOFFICE_URL}/reset-password?token=${rawBody.passwordResetToken}`
    expect(response.status).toBe(200)
    expect(body.user.id).toBe(PENDING_STAFF.id)
    expect(body.user.status).toBe('invited')
    expect(body.user.activatedAt).toBeNull()
    expect(mail.to).toBe('staff@example.com')
    expect(mail.subject).toBe('Votre accès au Backoffice Keimêlion')
    expect(mail.html).toContain('<strong>modérateur</strong>')
    expect(mail.html).toContain(`href="${setPasswordUrl}"`)
    expect(mail.text).toContain("Ce lien est valable 24 heures et ne fonctionne qu'une seule fois.")
  })

  it('replaces the stored token with the hash of the emailed one, valid 24 hours', async () => {
    const { set } = mockSuccessfulRenewal()

    const before = Date.now()
    await postResend()

    const emailedToken = /\?token=([a-f0-9]+)/.exec((await waitForSentMail()).text)?.[1] ?? ''
    const stored = set.mock.calls[0]?.[0] as { passwordResetToken: string; passwordResetTokenExpiresAt: Date }
    expect(stored.passwordResetToken).toBe(createHash('sha256').update(emailedToken).digest('hex'))
    expect(stored.passwordResetToken).not.toBe(PENDING_STAFF.passwordResetToken)
    expect(stored.passwordResetTokenExpiresAt.getTime() - before).toBeGreaterThanOrEqual(TWENTY_FOUR_HOURS_MS)
    expect(stored.passwordResetTokenExpiresAt.getTime() - before).toBeLessThan(TWENTY_FOUR_HOURS_MS + ONE_MINUTE_MS)
  })

  it('renews the token only while the staff invitation is still pending', async () => {
    const { where } = mockSuccessfulRenewal()

    await postResend()

    const whereSql = renderSql(where.mock.calls[0]?.[0] as SQL)
    expect(whereSql).toContain('"users"."role" in (')
    expect(whereSql).toContain(renderSql(buildUserStatusCondition(UserStatuses.INVITED)))
  })

  it('logs the resend at warn level without the recipient or the link', async () => {
    mockSuccessfulRenewal()

    await postResend()

    const emailedToken = /\?token=([a-f0-9]+)/.exec((await waitForSentMail()).text)?.[1] ?? ''
    const logs = JSON.stringify(vi.mocked(logger.warn).mock.calls)
    expect(logger.warn).toHaveBeenCalledWith({
      adminId: ADMIN_USER.id,
      targetUserId: PENDING_STAFF.id,
      action: 'admin_resend_staff_invitation',
      role: 'moderator',
    })
    expect(logs).not.toContain(emailedToken)
    expect(logs).not.toContain('staff@example.com')
  })

  it('still returns 200 when the provider fails, logging neither recipient nor link', async () => {
    mockSuccessfulRenewal()
    vi.mocked(sendMail).mockResolvedValueOnce({ isSuccess: false, reason: 'provider_error' })

    const response = await postResend()

    expect(response.status).toBe(200)
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith({
        event: 'admin_staff_invitation_email_failed',
        reason: 'provider_error',
      })
    })
  })

  it('does not return the token in production', async () => {
    const originalNodeEnv = env.NODE_ENV
    env.NODE_ENV = NodeEnvs.PRODUCTION
    try {
      mockSuccessfulRenewal()

      const response = await postResend()

      const body = await response.json() as { passwordResetToken?: string }
      expect(response.status).toBe(200)
      expect(body.passwordResetToken).toBeUndefined()
      await waitForSentMail()
    } finally {
      env.NODE_ENV = originalNodeEnv
    }
  })

  it('returns 409 STAFF_INVITATION_NOT_PENDING when the account is already activated', async () => {
    mockTargetUser({ ...PENDING_STAFF, activatedAt: new Date('2024-01-03') })
    mockTokenRenewal([])

    const response = await postResend()

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe(ErrorCode.STAFF_INVITATION_NOT_PENDING)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('returns 422 STAFF_INVITATION_NOT_STAFF_ACCOUNT for a regular user, without touching the token', async () => {
    mockTargetUser({ ...TARGET_USER, avatarImage: null })

    const response = await postResend(`/v1/admin/users/${TARGET_USER.id}/resend-invitation`)

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe(ErrorCode.STAFF_INVITATION_NOT_STAFF_ACCOUNT)
    expect(db.update).not.toHaveBeenCalled()
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('returns 404 when the user does not exist', async () => {
    mockTargetUser(undefined)

    const response = await postResend()

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe(ErrorCode.NOT_FOUND)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('returns 422 when id is not a UUID', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER)

    const response = await postResend('/v1/admin/users/not-a-uuid/resend-invitation')

    expect(response.status).toBe(422)
  })

  it('returns 403 when the caller is not an admin', async () => {
    const token = await generateTestToken(TARGET_USER.id)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(TARGET_USER)

    const response = await apiRequest(RESEND_PATH, { method: 'POST', token })

    expect(response.status).toBe(403)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('returns 401 when no authorization header is provided', async () => {
    const response = await apiRequest(RESEND_PATH, { method: 'POST' })

    expect(response.status).toBe(401)
  })
})
