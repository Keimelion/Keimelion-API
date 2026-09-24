import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../../db/client.js'
import { apiRequest } from '../../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../../shared/test/auth.js'
import { logger } from '../../../shared/utils/logger.js'

vi.mock('../../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const ADMIN_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@example.com',
  username: 'adminuser',
  passwordHash: 'hashed',
  authProvider: 'email' as const,
  role: 'admin' as const,
  avatarUrl: null,
  isCgvAccepted: true,
  cgvAcceptedAt: new Date('2024-01-01'),
  isMarketingOptedIn: false,
  emailVerifyToken: null,
  emailVerifyTokenExpiresAt: null,
  emailVerifiedAt: new Date('2024-01-02'),
  passwordResetToken: null,
  passwordResetTokenExpiresAt: null,
  lastActiveAt: null,
  deletedAt: null,
  bannedAt: null,
  banReason: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const NON_ADMIN_USER = {
  ...ADMIN_USER,
  id: '00000000-0000-0000-0000-000000000002',
  email: 'user@example.com',
  role: 'user' as const,
}

const MODERATOR_USER = {
  ...ADMIN_USER,
  id: '00000000-0000-0000-0000-000000000003',
  email: 'moderator@example.com',
  role: 'moderator' as const,
}

const OWNER_USER = {
  ...ADMIN_USER,
  id: '00000000-0000-0000-0000-000000000004',
  email: 'owner@example.com',
  username: 'owneruser',
  role: 'user' as const,
}

const LIST_ROW = {
  id: '00000000-0000-0000-0000-000000000010',
  occasionTypeId: null,
  title: 'Birthday wishlist',
  description: 'Things I want',
  listStatus: 'active' as const,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const DELETED_LIST_ROW = {
  ...LIST_ROW,
  id: '00000000-0000-0000-0000-000000000011',
  deletedAt: new Date('2024-06-01'),
}

const ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(ADMIN_USER.id)

function mockAdminAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(ADMIN_USER as never)
}

function mockNonAdminAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(
    makeAccessTokenEntry(NON_ADMIN_USER.id) as never,
  )
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(NON_ADMIN_USER as never)
}

function mockModeratorAuth(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(
    makeAccessTokenEntry(MODERATOR_USER.id) as never,
  )
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(MODERATOR_USER as never)
}

function mockFindListById(row: unknown): void {
  vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(row as never)
}

function mockCountChain(total: number): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce([{ count: total }]),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

function mockOwnersBatchChain(rows: { listId: string; owner: unknown }[]): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce(rows),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

function mockOwnerListIdsChain(listIds: string[]): void {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValueOnce(listIds.map((listId) => ({ listId }))),
  }
  vi.mocked(db.select).mockReturnValueOnce(chain as never)
}

function mockUpdateList(returnRow: unknown): void {
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([returnRow]),
      }),
    }),
  } as never)
}

describe('GET /v1/admin/lists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with paginated lists including owner', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.lists.findMany).mockResolvedValueOnce([LIST_ROW] as never)
    mockCountChain(1)
    mockOwnersBatchChain([{ listId: LIST_ROW.id, owner: OWNER_USER }])

    const response = await apiRequest('/v1/admin/lists', { token })

    const body = await response.json() as {
      items: { id: string; owner: { id: string } | null }[]
      pagination: { total: number }
    }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
    expect(body.items[0]?.owner?.id).toBe(OWNER_USER.id)
  })

  it('returns owner=null when the owner user is soft-deleted (collaborator FK set null)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.lists.findMany).mockResolvedValueOnce([LIST_ROW] as never)
    mockCountChain(1)
    mockOwnersBatchChain([{ listId: LIST_ROW.id, owner: null }])

    const response = await apiRequest('/v1/admin/lists', { token })

    const body = await response.json() as { items: { owner: null }[] }
    expect(response.status).toBe(200)
    expect(body.items[0]?.owner).toBeNull()
  })

  it('returns empty list when no lists exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.lists.findMany).mockResolvedValueOnce([] as never)
    mockCountChain(0)

    const response = await apiRequest('/v1/admin/lists', { token })

    const body = await response.json() as { items: unknown[]; pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
  })

  it('sorts by title:asc', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.lists.findMany).mockResolvedValueOnce([LIST_ROW] as never)
    mockCountChain(1)
    mockOwnersBatchChain([{ listId: LIST_ROW.id, owner: OWNER_USER }])

    const response = await apiRequest('/v1/admin/lists?sort=title:asc', { token })
    expect(response.status).toBe(200)
  })

  it('returns 422 when sort field is invalid', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/lists?sort=unknown:asc', { token })
    expect(response.status).toBe(422)
  })

  it('filters by listStatus[eq]', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.lists.findMany).mockResolvedValueOnce([LIST_ROW] as never)
    mockCountChain(1)
    mockOwnersBatchChain([{ listId: LIST_ROW.id, owner: OWNER_USER }])

    const response = await apiRequest('/v1/admin/lists?listStatus%5Beq%5D=active', { token })
    expect(response.status).toBe(200)
  })

  it('excludes soft-deleted lists by default', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.lists.findMany).mockResolvedValueOnce([LIST_ROW] as never)
    mockCountChain(1)
    mockOwnersBatchChain([{ listId: LIST_ROW.id, owner: OWNER_USER }])

    const response = await apiRequest('/v1/admin/lists', { token })
    const body = await response.json() as { items: { id: string }[] }
    expect(body.items.every((item) => item.id !== DELETED_LIST_ROW.id)).toBe(true)
  })

  it('includes soft-deleted lists when deletedAt filter is explicit', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    vi.mocked(db.query.lists.findMany).mockResolvedValueOnce([DELETED_LIST_ROW] as never)
    mockCountChain(1)
    mockOwnersBatchChain([{ listId: DELETED_LIST_ROW.id, owner: OWNER_USER }])

    const response = await apiRequest('/v1/admin/lists?deletedAt%5BisNull%5D=false', { token })
    const body = await response.json() as { items: { deletedAt: string | null }[] }
    expect(response.status).toBe(200)
    expect(body.items[0]?.deletedAt).not.toBeNull()
  })

  it('filters by ownerUserId and returns only matching lists', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockOwnerListIdsChain([LIST_ROW.id])
    vi.mocked(db.query.lists.findMany).mockResolvedValueOnce([LIST_ROW] as never)
    mockCountChain(1)
    mockOwnersBatchChain([{ listId: LIST_ROW.id, owner: OWNER_USER }])

    const response = await apiRequest(`/v1/admin/lists?ownerUserId=${OWNER_USER.id}`, { token })

    const body = await response.json() as { items: { id: string }[] }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]?.id).toBe(LIST_ROW.id)
  })

  it('returns empty result when ownerUserId matches no lists (pre-query short-circuit)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    mockOwnerListIdsChain([])

    const response = await apiRequest(`/v1/admin/lists?ownerUserId=${OWNER_USER.id}`, { token })

    const body = await response.json() as { items: unknown[]; pagination: { total: number } }
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
    expect(vi.mocked(db.query.lists.findMany)).not.toHaveBeenCalled()
  })

  it('returns 422 when ownerUserId is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/lists?ownerUserId=not-a-uuid', { token })
    expect(response.status).toBe(422)
  })

  it('returns 403 when caller is a moderator (admin only, not moderator)', async () => {
    const token = await generateTestToken(MODERATOR_USER.id, { role: 'moderator' })
    mockModeratorAuth()

    const response = await apiRequest('/v1/admin/lists', { token })
    expect(response.status).toBe(403)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest('/v1/admin/lists', { token })
    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest('/v1/admin/lists')
    expect(response.status).toBe(401)
  })
})

describe('GET /v1/admin/lists/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with list and owner', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)
    mockOwnersBatchChain([{ listId: LIST_ROW.id, owner: OWNER_USER }])

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, { token })

    const body = await response.json() as { list: { title: string; owner: { id: string } } }
    expect(response.status).toBe(200)
    expect(body.list.title).toBe(LIST_ROW.title)
    expect(body.list.owner.id).toBe(OWNER_USER.id)
  })

  it('returns 200 with deletedAt populated for soft-deleted lists (admins see everything)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(DELETED_LIST_ROW)
    mockOwnersBatchChain([{ listId: DELETED_LIST_ROW.id, owner: OWNER_USER }])

    const response = await apiRequest(`/v1/admin/lists/${DELETED_LIST_ROW.id}`, { token })

    const body = await response.json() as { list: { deletedAt: string | null } }
    expect(response.status).toBe(200)
    expect(body.list.deletedAt).not.toBeNull()
  })

  it('returns 404 when list does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(undefined)

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, { token })
    expect(response.status).toBe(404)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/lists/not-a-uuid', { token })
    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, { token })
    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`)
    expect(response.status).toBe(401)
  })
})

describe('PATCH /v1/admin/lists/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with updated list when patching title', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)
    mockUpdateList({ ...LIST_ROW, title: 'Updated title' })
    mockOwnersBatchChain([{ listId: LIST_ROW.id, owner: OWNER_USER }])

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { title: 'Updated title' },
    })

    const body = await response.json() as { list: { title: string } }
    expect(response.status).toBe(200)
    expect(body.list.title).toBe('Updated title')
  })

  it('returns 200 when patching listStatus', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)
    mockUpdateList({ ...LIST_ROW, listStatus: 'archived' })
    mockOwnersBatchChain([{ listId: LIST_ROW.id, owner: OWNER_USER }])

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { listStatus: 'archived' },
    })

    const body = await response.json() as { list: { listStatus: string } }
    expect(response.status).toBe(200)
    expect(body.list.listStatus).toBe('archived')
  })

  it('logs with title/description redacted and only change keys recorded', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)
    mockUpdateList({ ...LIST_ROW, title: 'New title', description: 'New description' })
    mockOwnersBatchChain([{ listId: LIST_ROW.id, owner: OWNER_USER }])

    await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { title: 'New title', description: 'New description' },
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin_update_list',
        listId: LIST_ROW.id,
        changes: {
          title: { from: '<redacted>', to: '<redacted>' },
          description: { from: '<redacted>', to: '<redacted>' },
        },
      }),
    )
  })

  it('returns 422 when body is empty (no fields)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, {
      method: 'PATCH',
      token,
      body: {},
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when unknown field is provided (strict schema)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { unknownField: 'value' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when listStatus is an invalid enum value', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { listStatus: 'banned' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when title is empty', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { title: '' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 422 when occasionTypeId does not exist (FK violation surfaced as friendly error)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockRejectedValueOnce({ code: '23503' }),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { occasionTypeId: '00000000-0000-0000-0000-000000000099' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 404 when list does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(undefined)

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { title: 'Updated' },
    })

    expect(response.status).toBe(404)
  })

  it('returns 404 when list is soft-deleted (cannot update without restoring first)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(DELETED_LIST_ROW)

    const response = await apiRequest(`/v1/admin/lists/${DELETED_LIST_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { title: 'Updated' },
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/lists/not-a-uuid', {
      method: 'PATCH',
      token,
      body: { title: 'Test' },
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, {
      method: 'PATCH',
      token,
      body: { title: 'Test' },
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, {
      method: 'PATCH',
      body: { title: 'Test' },
    })

    expect(response.status).toBe(401)
  })
})

describe('DELETE /v1/admin/lists/:id (soft delete)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 204 and soft-deletes an active list', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)
    mockUpdateList({ ...LIST_ROW, deletedAt: new Date() })

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(204)
  })

  it('logs at warn level on successful soft-delete', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)
    mockUpdateList({ ...LIST_ROW, deletedAt: new Date() })

    await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, { method: 'DELETE', token })

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_delete_list', listId: LIST_ROW.id }),
    )
  })

  it('returns 404 when list is already soft-deleted', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(DELETED_LIST_ROW)

    const response = await apiRequest(`/v1/admin/lists/${DELETED_LIST_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(404)
  })

  it('returns 404 when list does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(undefined)

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 when id is not a UUID', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()

    const response = await apiRequest('/v1/admin/lists/not-a-uuid', {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(422)
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}`, { method: 'DELETE' })
    expect(response.status).toBe(401)
  })
})

describe('POST /v1/admin/lists/:id/restore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  })

  it('returns 200 with restored list', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(DELETED_LIST_ROW)
    mockUpdateList({ ...DELETED_LIST_ROW, deletedAt: null })
    mockOwnersBatchChain([{ listId: DELETED_LIST_ROW.id, owner: OWNER_USER }])

    const response = await apiRequest(`/v1/admin/lists/${DELETED_LIST_ROW.id}/restore`, {
      method: 'POST',
      token,
    })

    const body = await response.json() as { list: { deletedAt: null } }
    expect(response.status).toBe(200)
    expect(body.list.deletedAt).toBeNull()
  })

  it('is idempotent-safe: restoring twice fails the second time with 404', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById({ ...DELETED_LIST_ROW, deletedAt: null })

    const response = await apiRequest(`/v1/admin/lists/${DELETED_LIST_ROW.id}/restore`, {
      method: 'POST',
      token,
    })

    expect(response.status).toBe(404)
  })

  it('returns 404 when list is not soft-deleted (active list)', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(LIST_ROW)

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}/restore`, {
      method: 'POST',
      token,
    })

    expect(response.status).toBe(404)
  })

  it('returns 404 when list does not exist', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(undefined)

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}/restore`, {
      method: 'POST',
      token,
    })

    expect(response.status).toBe(404)
  })

  it('logs at info level on successful restore', async () => {
    const token = await generateTestToken(ADMIN_USER.id, { role: 'admin' })
    mockAdminAuth()
    mockFindListById(DELETED_LIST_ROW)
    mockUpdateList({ ...DELETED_LIST_ROW, deletedAt: null })
    mockOwnersBatchChain([{ listId: DELETED_LIST_ROW.id, owner: OWNER_USER }])

    await apiRequest(`/v1/admin/lists/${DELETED_LIST_ROW.id}/restore`, {
      method: 'POST',
      token,
    })

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin_restore_list' }),
    )
  })

  it('returns 403 when user is not admin', async () => {
    const token = await generateTestToken(NON_ADMIN_USER.id)
    mockNonAdminAuth()

    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}/restore`, {
      method: 'POST',
      token,
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when no token is provided', async () => {
    const response = await apiRequest(`/v1/admin/lists/${LIST_ROW.id}/restore`, {
      method: 'POST',
    })

    expect(response.status).toBe(401)
  })
})
