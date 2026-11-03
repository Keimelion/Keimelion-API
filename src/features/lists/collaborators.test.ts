import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'
import { db } from '../../db/client.js'
import { apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'

const OWNER_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'owner@example.com',
  username: 'owner',
  passwordHash: 'hashed',
  authProvider: 'email' as const,
  role: 'user' as const,
  avatarUrl: null,
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
  return { ...row, listUsers: [{ userId: ownerId, user: owner }], listTags: [] }
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
  })

  it('returns 201 with the created invite and raw token in non-production', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwner()
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(undefined)
    vi.mocked(db.query.listUsers.findFirst).mockResolvedValueOnce(undefined)
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
    expect(response.status).toBe(201)
    expect(body.invite.invitedEmail).toBe('invitee@example.com')
    expect(body.invite.role).toBe('editor')
    expect(body.invite.inviteStatus).toBe('pending')
    expect(body.inviteToken).toMatch(/^[a-f0-9]{64}$/)
    expect(body.invite).not.toHaveProperty('inviteToken')
    expect(body.invite).not.toHaveProperty('inviteTokenExpiresAt')
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

  it('returns 409 COLLAB_ALREADY_MEMBER when a pending invite already exists', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwner()
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(BASE_INVITE_ROW)
    vi.mocked(db.query.listUsers.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/lists/${LIST_ID}/collaborators/invites`, {
      method: 'POST',
      token,
      body: { email: 'invitee@example.com' },
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(409)
    expect(body.code).toBe('COLLAB_ALREADY_MEMBER')
  })

  it('returns 409 COLLAB_ALREADY_MEMBER when an accepted editor already exists', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwner()
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(undefined)
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

  it('returns 409 COLLAB_ALREADY_MEMBER on partial-unique index race (23505)', async () => {
    const token = await generateTestToken(OWNER_USER.id)
    mockOwnerAuth()
    mockListWithOwner()
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(undefined)
    vi.mocked(db.query.listUsers.findFirst).mockResolvedValueOnce(undefined)
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

    const response = await apiRequest('/v1/collaborators/invites/accept', {
      method: 'POST',
      token,
      body: { token: RAW_TOKEN },
    })

    const body = await response.json() as {
      invite: { inviteStatus: string; user: { id: string } | null }
    }
    expect(response.status).toBe(200)
    expect(body.invite.inviteStatus).toBe('accepted')
    expect(body.invite.user?.id).toBe(INVITEE_USER.id)
  })

  it('returns 403 EMAIL_NOT_VERIFIED when caller has not verified their email', async () => {
    const token = await generateTestToken(UNVERIFIED_USER.id)
    mockInviteeAuth(UNVERIFIED_USER)

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

  it('returns 409 COLLAB_ALREADY_MEMBER on 23505 race during accept', async () => {
    const token = await generateTestToken(INVITEE_USER.id)
    mockInviteeAuth()
    vi.mocked(db.query.listInvites.findFirst).mockResolvedValueOnce(BASE_INVITE_ROW)
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
    vi.mocked(db.query.listUsers.findMany).mockResolvedValueOnce([
      {
        id: '00000000-0000-0000-0000-00000000d100',
        listId: LIST_ID,
        userId: OWNER_USER.id,
        role: 'owner' as const,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        user: OWNER_USER,
      },
    ] as never)
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
          user: { id: string } | null
          invitedEmail: string | null
          status: string
          role: string
        }[]
      }
    }
    expect(response.status).toBe(200)
    expect(body.list.collaborators).toHaveLength(2)
    expect(body.list.collaborators[0]?.role).toBe('owner')
    expect(body.list.collaborators[0]?.user?.id).toBe(OWNER_USER.id)
    expect(body.list.collaborators[1]?.role).toBe('editor')
    expect(body.list.collaborators[1]?.status).toBe('pending')
    expect(body.list.collaborators[1]?.invitedEmail).toBe('pending@example.com')
    expect(JSON.stringify(body)).not.toContain('inviteToken')
    expect(JSON.stringify(body)).not.toContain('inviteTokenExpiresAt')
  })
})
