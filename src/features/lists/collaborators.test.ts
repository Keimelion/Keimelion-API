import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'
import { db } from '../../db/client.js'
import { env } from '../../config/env.js'
import { NodeEnvs } from '../../shared/enums/node-env.js'
import { sendMail } from '../../shared/mail/mail.sender.js'
import { apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'
import { logger } from '../../shared/utils/logger.js'
import { listInvites } from '../../db/entities/list-invites/list-invites.schema.js'
import { listUsers } from '../../db/entities/list-users/list-users.schema.js'
import {
  collaboratorsAcceptInviteResponseSchema,
  collaboratorsCreateInviteResponseSchema,
  listsGetResponseSchema,
} from '@keimelion/sdk/schemas'

vi.mock('../../shared/mail/mail.sender.js', () => ({ sendMail: vi.fn() }))

const WEB_APP_URL = 'https://app.keimelion.test'
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const ONE_MINUTE_MS = 60 * 1000

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

function spyOnAllLogLevels(): () => string {
  const spies = (['debug', 'info', 'warn', 'error'] as const).map((level) =>
    vi.spyOn(logger, level).mockImplementation(() => undefined),
  )
  return () => JSON.stringify(spies.map((spy) => spy.mock.calls))
}

const OWNER_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'owner@example.com',
  username: 'owner' as string | null,
  passwordHash: 'hashed',
  authProvider: 'email' as const,
  role: 'user' as const,
  avatarImageId: null,
  isCgvAccepted: true,
  cgvAcceptedAt: new Date('2024-01-01'),
  isMarketingOptedIn: false,
  defaultCurrencyCode: 'USD',
  emailVerifyToken: null,
  emailVerifyTokenExpiresAt: null,
  emailVerifiedAt: new Date('2024-01-02') as Date | null,
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

const INVITEE_USER = {
  ...OWNER_USER,
  id: '00000000-0000-0000-0000-000000000002',
  email: 'invitee@example.com',
  username: 'invitee',
}

const UNVERIFIED_USER = { ...INVITEE_USER, emailVerifiedAt: null }

const LIST_ID = '00000000-0000-0000-0000-000000000010'

const MOCK_LIST = {
  id: LIST_ID,
  occasionTypeId: null,
  eventDate: null,
  title: 'Birthday wishlist',
  slug: 'birthday-abc',
  description: null,
  listStatus: 'active' as const,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const OWNER_ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(OWNER_USER.id)
const INVITEE_ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(INVITEE_USER.id)

function rowWithOwner(row: object, owner: unknown): object {
  if (owner === null) return { ...row, listUsers: [], listTags: [] }
  const ownerId = (owner as { id: string }).id
  return { ...row, listUsers: [{ userId: ownerId, role: "owner" as const, user: owner }], listTags: [] }
}

function mockOwnerAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(OWNER_ACCESS_TOKEN_ENTRY)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(OWNER_USER)
}

function mockInviteeAuth(user: typeof INVITEE_USER = INVITEE_USER): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(INVITEE_ACCESS_TOKEN_ENTRY)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(user)
}

function mockListWithOwner(owner: unknown = OWNER_USER): void {
  vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(rowWithOwner(MOCK_LIST, owner) as never)
}

function mockInsertInvite(returnRow: unknown): void {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([returnRow]),
    }),
  } as never)
}

function mockPurgeExpiredInvites(): void {
  vi.mocked(db.delete).mockReturnValueOnce({
    where: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([]),
    }),
  } as never)
}

function mockInviteListExists(): void {
  vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(MOCK_LIST)
}

const EDITOR_MEMBERSHIP = {
  id: '00000000-0000-0000-0000-00000000d100',
  listId: LIST_ID,
  userId: INVITEE_USER.id,
  role: 'editor' as const,
  createdAt: new Date('2024-01-02'),
  updatedAt: new Date('2024-01-02'),
}

function mockListWithOwnerAndEditor(): void {
  vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce({
    ...MOCK_LIST,
    listUsers: [
      { userId: OWNER_USER.id, role: 'owner' as const, createdAt: new Date('2024-01-01'), user: OWNER_USER },
      { userId: INVITEE_USER.id, role: 'editor' as const, createdAt: new Date('2024-01-02'), user: INVITEE_USER },
    ],
    listTags: [],
  } as never)
}

function mockInviteUpdate(returnRows: unknown[]): ReturnType<typeof vi.fn> {
  const setSpy = vi.fn().mockReturnValueOnce({
    where: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce(returnRows),
    }),
  })
  vi.mocked(db.update).mockReturnValueOnce({ set: setSpy } as never)
  return setSpy
}

function mockMembershipDelete(returnRows: unknown[]): void {
  vi.mocked(db.delete).mockReturnValueOnce({
    where: vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce(returnRows),
    }),
  } as never)
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

const RAW_TOKEN = 'a'.repeat(64)
const RAW_TOKEN_HASH = sha256Hex(RAW_TOKEN)

const BASE_INVITE_ROW = {
  id: '00000000-0000-0000-0000-00000000d001',
  listId: LIST_ID,
  invitedByUserId: OWNER_USER.id as string | null,
  invitedEmail: 'invitee@example.com',
  role: 'editor' as const,
  inviteToken: RAW_TOKEN_HASH,
  inviteTokenExpiresAt: new Date(Date.now() + 60_000),
  inviteStatus: 'pending' as const,
  acceptedAt: null as Date | null,
  acceptedByUserId: null as string | null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

describe('POST /v1/lists/:listId/collaborators/invites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sendMail).mockResolvedValue({ isSuccess: true, messageId: 'message-1' })
  })

  async function postInvite(
    owner: typeof OWNER_USER = OWNER_USER,
    list: typeof MOCK_LIST = MOCK_LIST,
  ): Promise<Response> {
    const token = await generateTestToken(owner.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(OWNER_ACCESS_TOKEN_ENTRY)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(owner)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(rowWithOwner(list, owner) as never)
    vi.mocked(db.query.listUsers.findFirst).mockResolvedValueOnce(undefined)
    mockPurgeExpiredInvites()
    return apiRequest(`/v1/lists/${LIST_ID}/collaborators/invites`, {
      method: 'POST',
      token,
      body: { email: 'Invitee@Example.com' },
    })
  }

  it('emails the invited address a French invitation linking the web app with the raw token', async () => {
    const valuesSpy = vi.fn().mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([BASE_INVITE_ROW]),
    })
    vi.mocked(db.insert).mockReturnValueOnce({ values: valuesSpy } as never)

    const before = Date.now()
    const response = await postInvite()

    const body = (await response.json()) as { inviteToken: string }
    const mail = await waitForSentMail()
    const acceptUrl = `${WEB_APP_URL}/invites/accept#token=${body.inviteToken}`
    const inserted = valuesSpy.mock.calls[0]?.[0] as { inviteToken: string; inviteTokenExpiresAt: Date }
    expect(response.status).toBe(201)
    expect(mail.to).toBe('invitee@example.com')
    expect(mail.subject).toBe('owner vous invite sur la liste « Birthday wishlist »')
    expect(mail.html).toContain('<html lang="fr">')
    expect(mail.html).toContain('<strong>owner</strong> (owner@example.com) vous invite')
    expect(mail.html).toContain(`href="${acceptUrl}"`)
    expect(mail.html).toContain('banner-invitation.png')
    expect(mail.text).toContain(`Rejoindre la liste :\n${acceptUrl}`)
    expect(mail.text).toContain("L'invitation est valable 7 jours.")
    expect(inserted.inviteToken).toBe(sha256Hex(body.inviteToken))
    expect(inserted.inviteTokenExpiresAt.getTime() - before).toBeGreaterThanOrEqual(SEVEN_DAYS_MS)
    expect(inserted.inviteTokenExpiresAt.getTime() - before).toBeLessThan(SEVEN_DAYS_MS + ONE_MINUTE_MS)
  })

  it('escapes the list title and names an inviter without username by address', async () => {
    mockInsertInvite(BASE_INVITE_ROW)
    const owner = { ...OWNER_USER, username: null }

    await postInvite(owner, { ...MOCK_LIST, title: '<b>Léa & Axel</b>' })

    const mail = await waitForSentMail()
    expect(mail.html).toContain('<strong>&lt;b&gt;Léa &amp; Axel&lt;/b&gt;</strong>')
    expect(mail.html).not.toContain('<b>Léa')
    expect(mail.html).toContain('<strong>owner@example.com</strong> vous invite')
    expect(mail.subject).toBe('owner@example.com vous invite sur la liste « <b>Léa & Axel</b> »')
  })

  it('still returns 201 when the provider fails, logging neither recipient nor link', async () => {
    mockInsertInvite(BASE_INVITE_ROW)
    vi.mocked(sendMail).mockResolvedValueOnce({ isSuccess: false, reason: 'provider_error' })
    const readLogs = spyOnAllLogLevels()

    const response = await postInvite()

    expect(response.status).toBe(201)
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith({
        event: 'list_invitation_email_failed',
        reason: 'provider_error',
      })
    })
    expect(readLogs()).not.toContain('invitee@example.com')
    expect(readLogs()).not.toContain('#token=')
  })

  it('keeps the invited address and the token out of the production logs and response', async () => {
    const originalNodeEnv = env.NODE_ENV
    env.NODE_ENV = NodeEnvs.PRODUCTION
    const readLogs = spyOnAllLogLevels()
    try {
      mockInsertInvite(BASE_INVITE_ROW)

      const response = await postInvite()

      const body = (await response.json()) as { inviteToken?: string }
      const emailedToken = /#token=([a-f0-9]+)/.exec((await waitForSentMail()).text)?.[1] ?? ''
      expect(response.status).toBe(201)
      expect(body.inviteToken).toBeUndefined()
      expect(emailedToken).toMatch(/^[a-f0-9]{64}$/)
      expect(readLogs()).not.toContain(emailedToken)
      expect(readLogs()).not.toContain('invitee@example.com')
      expect(logger.info).toHaveBeenCalledWith(
        { ownerId: OWNER_USER.id, listId: LIST_ID, inviteId: BASE_INVITE_ROW.id },
        'Collaborator invite created',
      )
    } finally {
      env.NODE_ENV = originalNodeEnv
    }
  })

  it('returns 201 with the created invite and raw token in non-production', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwner()
    vi.mocked(db.query.listUsers.findFirst).mockResolvedValueOnce(undefined)
    mockPurgeExpiredInvites()
    mockInsertInvite(BASE_INVITE_ROW)

    const response = await apiRequest(`/v1/lists/${LIST_ID}/collaborators/invites`, {
      method: 'POST',
      token,
      body: { email: 'Invitee@Example.com' },
    })

    const body = await response.json() as {
      invite: { invitedEmail: string; role: string; inviteStatus: string }
      inviteToken: string
    }
    collaboratorsCreateInviteResponseSchema.parse(body)
    expect(response.status).toBe(201)
    expect(body.invite.invitedEmail).toBe('invitee@example.com')
    expect(body.invite.role).toBe('editor')
    expect(body.invite.inviteStatus).toBe('pending')
    expect(body.inviteToken).toMatch(/^[a-f0-9]{64}$/)
    expect(body.invite).not.toHaveProperty('inviteToken')
    expect(body.invite).not.toHaveProperty('inviteTokenExpiresAt')
  })

  it('purges an expired pending invite on the list before inserting the new one', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwner()
    vi.mocked(db.query.listUsers.findFirst).mockResolvedValueOnce(undefined)
    mockPurgeExpiredInvites()
    mockInsertInvite(BASE_INVITE_ROW)

    const response = await apiRequest(`/v1/lists/${LIST_ID}/collaborators/invites`, {
      method: 'POST',
      token,
      body: { email: 'invitee@example.com' },
    })

    expect(response.status).toBe(201)
    expect(vi.mocked(db.delete)).toHaveBeenCalledOnce()
    const deleteOrder = vi.mocked(db.delete).mock.invocationCallOrder[0] ?? Infinity
    const insertOrder = vi.mocked(db.insert).mock.invocationCallOrder[0] ?? -Infinity
    expect(deleteOrder).toBeLessThan(insertOrder)
  })

  it('returns 422 COLLAB_SELF_INVITE when the invited email matches the owner', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwner()

    const response = await apiRequest(`/v1/lists/${LIST_ID}/collaborators/invites`, {
      method: 'POST',
      token,
      body: { email: 'owner@example.com' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('COLLAB_SELF_INVITE')
  })

  it('returns 409 COLLAB_ALREADY_MEMBER when a pending invite already exists (partial unique races)', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwner()
    vi.mocked(db.query.listUsers.findFirst).mockResolvedValueOnce(undefined)
    mockPurgeExpiredInvites()
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockRejectedValueOnce(Object.assign(new Error('unique'), { code: '23505' })),
      }),
    } as never)

    const response = await apiRequest(`/v1/lists/${LIST_ID}/collaborators/invites`, {
      method: 'POST',
      token,
      body: { email: 'invitee@example.com' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('COLLAB_ALREADY_MEMBER')
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('returns 409 COLLAB_ALREADY_MEMBER when an accepted editor already exists', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwner()
    vi.mocked(db.query.listUsers.findFirst).mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-00000000d100',
      listId: LIST_ID,
      userId: INVITEE_USER.id,
      role: 'editor' as const,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    })

    const response = await apiRequest(`/v1/lists/${LIST_ID}/collaborators/invites`, {
      method: 'POST',
      token,
      body: { email: 'invitee@example.com' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('COLLAB_ALREADY_MEMBER')
  })

  it('returns 403 when the caller is not the list owner', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    mockListWithOwner()

    const response = await apiRequest(`/v1/lists/${LIST_ID}/collaborators/invites`, {
      method: 'POST',
      token,
      body: { email: 'other@example.com' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 404 when the list is soft-deleted', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      rowWithOwner({ ...MOCK_LIST, deletedAt: new Date('2024-06-01') }, OWNER_USER) as never,
    )

    const response = await apiRequest(`/v1/lists/${LIST_ID}/collaborators/invites`, {
      method: 'POST',
      token,
      body: { email: 'invitee@example.com' },
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 when email is missing or malformed', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest(`/v1/lists/${LIST_ID}/collaborators/invites`, {
      method: 'POST',
      token,
      body: { email: 'not-an-email' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/lists/${LIST_ID}/collaborators/invites`, {
      method: 'POST',
      body: { email: 'x@example.com' },
    })

    expect(response.status).toBe(401)
  })
})

describe('POST /v1/collaborators/invites/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 and marks the invite accepted when the token matches a pending invite', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(BASE_INVITE_ROW)
    mockInviteListExists()
    const acceptedRow = {
      ...BASE_INVITE_ROW,
      inviteStatus: 'accepted' as const,
      acceptedByUserId: INVITEE_USER.id,
      acceptedAt: new Date(),
    }
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([acceptedRow]),
        }),
      }),
    } as never)
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([
          {
            id: '00000000-0000-0000-0000-00000000d200',
            listId: LIST_ID,
            userId: INVITEE_USER.id,
            role: 'editor' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      }),
    } as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({ ...INVITEE_USER, avatarImage: null } as never)

    const response = await apiRequest('/v1/collaborators/invites/accept', {
      method: 'POST',
      token,
      body: { token: RAW_TOKEN },
    })

    const body = await response.json() as {
      invite: { inviteStatus: string; user: { id: string } | null }
    }
    collaboratorsAcceptInviteResponseSchema.parse(body)
    expect(response.status).toBe(200)
    expect(body.invite.inviteStatus).toBe('accepted')
    expect(body.invite.user?.id).toBe(INVITEE_USER.id)
  })

  it('returns 403 EMAIL_NOT_VERIFIED when caller has not verified their email, even inside the grace period', async () => {
    const token = await generateTestToken(UNVERIFIED_USER.id)
    mockInviteeAuth({ ...UNVERIFIED_USER, createdAt: new Date() })

    const response = await apiRequest('/v1/collaborators/invites/accept', {
      method: 'POST',
      token,
      body: { token: RAW_TOKEN },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(403)
    expect(body.code).toBe('EMAIL_NOT_VERIFIED')
  })

  it('returns 404 COLLAB_INVITE_NOT_FOUND when the token hash does not match', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest('/v1/collaborators/invites/accept', {
      method: 'POST',
      token,
      body: { token: RAW_TOKEN },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('COLLAB_INVITE_NOT_FOUND')
  })

  it('returns 409 COLLAB_INVITE_ALREADY_RESOLVED when the invite is already accepted', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(
      { ...BASE_INVITE_ROW, inviteStatus: 'accepted' } as never,
    )

    const response = await apiRequest('/v1/collaborators/invites/accept', {
      method: 'POST',
      token,
      body: { token: RAW_TOKEN },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('COLLAB_INVITE_ALREADY_RESOLVED')
  })

  it.each(['declined', 'revoked'] as const)(
    'returns 409 COLLAB_INVITE_ALREADY_RESOLVED when the invite was %s',
    async (inviteStatus) => {
      const token = await generateTestToken(INVITEE_USER.id)
      mockInviteeAuth()
      vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce({ ...BASE_INVITE_ROW, inviteStatus })

      const response = await apiRequest('/v1/collaborators/invites/accept', {
        method: 'POST',
        token,
        body: { token: RAW_TOKEN },
      })

      const body = await response.json() as { code: string }
      expect(response.status).toBe(409)
      expect(body.code).toBe('COLLAB_INVITE_ALREADY_RESOLVED')
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
    },
  )

  it('returns 410 COLLAB_INVITE_EXPIRED when the invite TTL has passed', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce({
      ...BASE_INVITE_ROW,
      inviteTokenExpiresAt: new Date(Date.now() - 60_000),
    })

    const response = await apiRequest('/v1/collaborators/invites/accept', {
      method: 'POST',
      token,
      body: { token: RAW_TOKEN },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(410)
    expect(body.code).toBe('COLLAB_INVITE_EXPIRED')
  })

  it('returns 403 COLLAB_EMAIL_MISMATCH when caller email does not match invitedEmail', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce({
      ...BASE_INVITE_ROW,
      invitedEmail: 'someone-else@example.com',
    })

    const response = await apiRequest('/v1/collaborators/invites/accept', {
      method: 'POST',
      token,
      body: { token: RAW_TOKEN },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(403)
    expect(body.code).toBe('COLLAB_EMAIL_MISMATCH')
  })

  it('returns 409 COLLAB_INVITE_ALREADY_RESOLVED when the invite is revoked/expired between read and update (TOCTOU)', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    // findInviteByTokenHash returns a pending invite, but markInviteAccepted's
    // WHERE narrows to still-pending/not-expired and finds nothing → the
    // transaction throws the sentinel which maps to COLLAB_INVITE_ALREADY_RESOLVED.
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(BASE_INVITE_ROW)
    mockInviteListExists()
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([]),
        }),
      }),
    } as never)

    const response = await apiRequest('/v1/collaborators/invites/accept', {
      method: 'POST',
      token,
      body: { token: RAW_TOKEN },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('COLLAB_INVITE_ALREADY_RESOLVED')
  })

  it('returns 409 COLLAB_ALREADY_MEMBER on 23505 race during accept', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(BASE_INVITE_ROW)
    mockInviteListExists()
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockRejectedValueOnce(Object.assign(new Error('unique'), { code: '23505' })),
        }),
      }),
    } as never)

    const response = await apiRequest('/v1/collaborators/invites/accept', {
      method: 'POST',
      token,
      body: { token: RAW_TOKEN },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('COLLAB_ALREADY_MEMBER')
  })

  it('returns 404 COLLAB_INVITE_NOT_FOUND when the invite targets a soft-deleted list', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(BASE_INVITE_ROW)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest('/v1/collaborators/invites/accept', {
      method: 'POST',
      token,
      body: { token: RAW_TOKEN },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('COLLAB_INVITE_NOT_FOUND')
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
  })

  it('returns 422 when token format is invalid', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()

    const response = await apiRequest('/v1/collaborators/invites/accept', {
      method: 'POST',
      token,
      body: { token: 'short' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest('/v1/collaborators/invites/accept', {
      method: 'POST',
      body: { token: RAW_TOKEN },
    })

    expect(response.status).toBe(401)
  })
})

describe('GET /v1/lists/:id — embeds collaborators for owner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('embeds owner first and includes a pending invite as a separate entry', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwner()
    vi.mocked(db.query.listInvites.findMany).mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-00000000d101',
        listId: LIST_ID,
        invitedByUserId: OWNER_USER.id,
        invitedEmail: 'pending@example.com',
        role: 'editor' as const,
        inviteToken: RAW_TOKEN_HASH,
        inviteTokenExpiresAt: new Date(Date.now() + 60_000),
        inviteStatus: 'pending' as const,
        acceptedAt: null,
        acceptedByUserId: null,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ] as never)

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { token })

    const body = await response.json() as {
      list: {
        collaborators: {
          inviteId: string | null
          user: { id: string } | null
          invitedEmail: string | null
          status: string
          role: string
        }[]
      }
    }
    listsGetResponseSchema.parse(body)
    expect(response.status).toBe(200)
    expect(body.list.collaborators[0]?.inviteId).toBeNull()
    expect(body.list.collaborators[1]?.inviteId).toBe('00000000-0000-0000-0000-00000000d101')
    expect(body.list.collaborators).toHaveLength(2)
    expect(body.list.collaborators[0]?.role).toBe('owner')
    expect(body.list.collaborators[0]?.user?.id).toBe(OWNER_USER.id)
    expect(body.list.collaborators[1]?.role).toBe('editor')
    expect(body.list.collaborators[1]?.status).toBe('pending')
    expect(body.list.collaborators[1]?.invitedEmail).toBe('pending@example.com')
    expect(JSON.stringify(body)).not.toContain('inviteToken')
    expect(JSON.stringify(body)).not.toContain('inviteTokenExpiresAt')
  })

  it('lets the editor read the list but only exposes a narrow identity of the owner', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce({
      ...MOCK_LIST,
      listUsers: [
        { userId: OWNER_USER.id, role: 'owner' as const, createdAt: new Date('2024-01-01'), user: OWNER_USER },
        { userId: INVITEE_USER.id, role: 'editor' as const, createdAt: new Date('2024-01-02'), user: INVITEE_USER },
      ],
      listTags: [],
    } as never)

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { token })

    const body = await response.json() as {
      list: {
        owner: Record<string, unknown> | null
        collaborators: { inviteId: string | null; user: Record<string, unknown> | null; role: string }[]
      }
    }
    expect(response.status).toBe(200)
    expect(body.list.collaborators.map((entry) => entry.role)).toEqual(['owner', 'editor'])
    expect(body.list.collaborators.map((entry) => entry.inviteId)).toEqual([null, null])
    expect(Object.keys(body.list.owner ?? {}).sort()).toEqual(['avatar', 'email', 'id', 'username'])
    for (const entry of body.list.collaborators) {
      expect(entry.user).not.toHaveProperty('isMarketingOptedIn')
      expect(entry.user).not.toHaveProperty('role')
      expect(entry.user).not.toHaveProperty('cgvAcceptedAt')
    }
  })
})

describe('GET /v1/lists/:id — after the editor was removed or left', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 to the former editor once their membership is gone', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    mockListWithOwner()

    const response = await apiRequest(`/v1/lists/${LIST_ID}`, { token })

    expect(response.status).toBe(403)
  })
})

describe('POST /v1/collaborators/invites/decline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function postDecline(options: { token?: string; body?: unknown } = {}): Promise<Response> {
    return apiRequest('/v1/collaborators/invites/decline', {
      method: 'POST',
      body: options.body ?? { token: RAW_TOKEN },
      ...(options.token === undefined ? {} : { token: options.token }),
    })
  }

  it('returns 204 without auth, marks the invite declined and creates no membership', async () => {
    const readLogs = spyOnAllLogLevels()
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(BASE_INVITE_ROW)
    const setSpy = mockInviteUpdate([{ ...BASE_INVITE_ROW, inviteStatus: 'declined' }])

    const response = await postDecline()

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(setSpy).toHaveBeenCalledExactlyOnceWith({ inviteStatus: 'declined' })
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
    expect(vi.mocked(db.query.listInvites.findFirst)).toHaveBeenCalledOnce()
    expect(logger.info).toHaveBeenCalledWith(
      { listId: LIST_ID, inviteId: BASE_INVITE_ROW.id },
      'Collaborator invite declined',
    )
    expect(readLogs()).not.toContain(RAW_TOKEN)
    expect(readLogs()).not.toContain('invitee@example.com')
  })

  it('applies no email-match and no verified-email check for a logged-in caller', async () => {
    const token = await generateTestToken(UNVERIFIED_USER.id)
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce({
      ...BASE_INVITE_ROW,
      invitedEmail: 'someone-else@example.com',
    })
    mockInviteUpdate([{ ...BASE_INVITE_ROW, inviteStatus: 'declined' }])

    const response = await postDecline({ token })

    expect(response.status).toBe(204)
    expect(vi.mocked(db.query.accessTokens.findFirst)).not.toHaveBeenCalled()
  })

  it('returns 404 COLLAB_INVITE_NOT_FOUND for an unknown token', async () => {
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(undefined)

    const response = await postDecline()

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('COLLAB_INVITE_NOT_FOUND')
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
  })

  it('returns 410 COLLAB_INVITE_EXPIRED for an expired pending invite', async () => {
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce({
      ...BASE_INVITE_ROW,
      inviteTokenExpiresAt: new Date(Date.now() - 60_000),
    })

    const response = await postDecline()

    const body = await response.json() as { code: string }
    expect(response.status).toBe(410)
    expect(body.code).toBe('COLLAB_INVITE_EXPIRED')
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
  })

  it.each(['accepted', 'declined', 'revoked'] as const)(
    'returns 409 COLLAB_INVITE_ALREADY_RESOLVED when the invite is already %s',
    async (inviteStatus) => {
      vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce({ ...BASE_INVITE_ROW, inviteStatus })

      const response = await postDecline()

      const body = await response.json() as { code: string }
      expect(response.status).toBe(409)
      expect(body.code).toBe('COLLAB_INVITE_ALREADY_RESOLVED')
      expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    },
  )

  it('returns 409 COLLAB_INVITE_ALREADY_RESOLVED when an accept wins the race (conditional update returns no row)', async () => {
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(BASE_INVITE_ROW)
    mockInviteUpdate([])

    const response = await postDecline()

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('COLLAB_INVITE_ALREADY_RESOLVED')
  })

  it.each([
    ['missing', {}],
    ['empty', { token: '' }],
  ])('returns 422 when the token is %s', async (_label, body) => {
    const response = await postDecline({ body })

    const responseBody = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(responseBody.code).toBe('UNPROCESSABLE_ENTITY')
    expect(vi.mocked(db.query.listInvites.findFirst)).not.toHaveBeenCalled()
  })
})

describe('DELETE /v1/lists/:id/collaborators/invites/:inviteId', () => {
  const REVOKE_PATH = `/v1/lists/${LIST_ID}/collaborators/invites/${BASE_INVITE_ROW.id}`

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 204 and marks the pending invite revoked', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwner()
    const setSpy = mockInviteUpdate([{ ...BASE_INVITE_ROW, inviteStatus: 'revoked' }])

    const response = await apiRequest(REVOKE_PATH, { method: 'DELETE', token })

    expect(response.status).toBe(204)
    expect(setSpy).toHaveBeenCalledExactlyOnceWith({ inviteStatus: 'revoked' })
    expect(logger.info).toHaveBeenCalledWith(
      { ownerId: OWNER_USER.id, listId: LIST_ID, inviteId: BASE_INVITE_ROW.id },
      'Collaborator invite revoked',
    )
  })

  it('returns 404 COLLAB_INVITE_NOT_FOUND when the invite does not exist on this list', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwner()
    mockInviteUpdate([])
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(REVOKE_PATH, { method: 'DELETE', token })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('COLLAB_INVITE_NOT_FOUND')
  })

  it.each(['accepted', 'declined', 'revoked'] as const)(
    'returns 409 COLLAB_INVITE_ALREADY_RESOLVED when the invite is %s (including an accept winning the race)',
    async (inviteStatus) => {
      const token = await generateTestToken(OWNER_USER.id)
      mockOwnerAuth()
      mockListWithOwner()
      mockInviteUpdate([])
      vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce({ ...BASE_INVITE_ROW, inviteStatus })

      const response = await apiRequest(REVOKE_PATH, { method: 'DELETE', token })

      const body = await response.json() as { code: string }
      expect(response.status).toBe(409)
      expect(body.code).toBe('COLLAB_INVITE_ALREADY_RESOLVED')
    },
  )

  it('returns 403 when the editor calls revoke', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    mockListWithOwnerAndEditor()

    const response = await apiRequest(REVOKE_PATH, { method: 'DELETE', token })

    expect(response.status).toBe(403)
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
  })

  it('returns 403 when a non-member calls revoke', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    mockListWithOwner()

    const response = await apiRequest(REVOKE_PATH, { method: 'DELETE', token })

    expect(response.status).toBe(403)
  })

  it('returns 401 without auth', async () => {
    const response = await apiRequest(REVOKE_PATH, { method: 'DELETE' })

    expect(response.status).toBe(401)
  })

  it('returns 422 when the inviteId is not a uuid', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest(`/v1/lists/${LIST_ID}/collaborators/invites/not-a-uuid`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(422)
  })
})

describe('DELETE /v1/lists/:id/collaborators/:userId', () => {
  const REMOVE_PATH = `/v1/lists/${LIST_ID}/collaborators/${INVITEE_USER.id}`

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 204, deletes the editor membership and its accepted invite in one transaction', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwnerAndEditor()
    mockMembershipDelete([EDITOR_MEMBERSHIP])

    const response = await apiRequest(REMOVE_PATH, { method: 'DELETE', token })

    expect(response.status).toBe(204)
    expect(vi.mocked(db.transaction)).toHaveBeenCalledOnce()
    expect(vi.mocked(db.delete).mock.calls.map(([table]) => table)).toEqual([listUsers, listInvites])
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      { ownerId: OWNER_USER.id, listId: LIST_ID, editorId: INVITEE_USER.id },
      'Collaborator removed from list',
    )
  })

  it.each([
    ['an unknown user or non-member', '00000000-0000-0000-0000-00000000ffff'],
    ["the owner's own id", OWNER_USER.id],
  ])('returns 404 COLLAB_MEMBER_NOT_FOUND for %s', async (_label, userId) => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwner()
    mockMembershipDelete([])

    const response = await apiRequest(`/v1/lists/${LIST_ID}/collaborators/${userId}`, { method: 'DELETE', token })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('COLLAB_MEMBER_NOT_FOUND')
    expect(vi.mocked(db.delete).mock.calls.map(([table]) => table)).toEqual([listUsers])
  })

  it('returns 403 when the editor calls remove', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    mockListWithOwnerAndEditor()

    const response = await apiRequest(REMOVE_PATH, { method: 'DELETE', token })

    expect(response.status).toBe(403)
    expect(vi.mocked(db.delete)).not.toHaveBeenCalled()
  })

  it('returns 401 without auth', async () => {
    const response = await apiRequest(REMOVE_PATH, { method: 'DELETE' })

    expect(response.status).toBe(401)
  })

  it('returns 422 when the userId is not a uuid', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()

    const response = await apiRequest(`/v1/lists/${LIST_ID}/collaborators/not-a-uuid`, { method: 'DELETE', token })

    expect(response.status).toBe(422)
  })
})

describe('DELETE /v1/lists/:id/collaborators/me', () => {
  const LEAVE_PATH = `/v1/lists/${LIST_ID}/collaborators/me`

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 204 and deletes the editor membership (the /me route is not captured by /:userId)', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    mockListWithOwnerAndEditor()
    mockMembershipDelete([EDITOR_MEMBERSHIP])

    const response = await apiRequest(LEAVE_PATH, { method: 'DELETE', token })

    expect(response.status).toBe(204)
    expect(vi.mocked(db.transaction)).toHaveBeenCalledOnce()
    expect(vi.mocked(db.delete).mock.calls.map(([table]) => table)).toEqual([listUsers, listInvites])
    expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      { editorId: INVITEE_USER.id, listId: LIST_ID },
      'Collaborator left list',
    )
  })

  it('returns 422 COLLAB_OWNER_CANNOT_LEAVE for the owner and deletes nothing', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwnerAndEditor()

    const response = await apiRequest(LEAVE_PATH, { method: 'DELETE', token })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('COLLAB_OWNER_CANNOT_LEAVE')
    expect(vi.mocked(db.delete)).not.toHaveBeenCalled()
  })

  it('returns 403 for a user who is not a contributor (e.g. a second leave call)', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    mockListWithOwner()

    const response = await apiRequest(LEAVE_PATH, { method: 'DELETE', token })

    expect(response.status).toBe(403)
    expect(vi.mocked(db.delete)).not.toHaveBeenCalled()
  })

  it('returns 404 COLLAB_MEMBER_NOT_FOUND when a concurrent remove already deleted the membership', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    mockListWithOwnerAndEditor()
    mockMembershipDelete([])

    const response = await apiRequest(LEAVE_PATH, { method: 'DELETE', token })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(404)
    expect(body.code).toBe('COLLAB_MEMBER_NOT_FOUND')
    expect(vi.mocked(db.delete).mock.calls.map(([table]) => table)).toEqual([listUsers])
  })

  it('returns 401 without auth', async () => {
    const response = await apiRequest(LEAVE_PATH, { method: 'DELETE' })

    expect(response.status).toBe(401)
  })
})
