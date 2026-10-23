import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/client.js'
import { apiMultipartRequest, apiRequest } from '../../shared/test/api-request.js'
import { generateTestToken, makeAccessTokenEntry } from '../../shared/test/auth.js'
import type * as ImagesService from '../uploads/images.service.js'

const { mockProcessOptionalImage, mockCleanupReplacedImage } = vi.hoisted(() => ({
  mockProcessOptionalImage: vi.fn(),
  mockCleanupReplacedImage: vi.fn(),
}))
vi.mock('../uploads/images.service.js', async () => {
  const actual = await vi.importActual<typeof ImagesService>('../uploads/images.service.js')
  return {
    ...actual,
    processOptionalImage: mockProcessOptionalImage,
    cleanupReplacedImage: mockCleanupReplacedImage,
  }
})

const MOCK_IMAGE_ROW = {
  id: '00000000-0000-0000-0000-0000000000aa',
  hash: 'a'.repeat(64),
  fileKey: 'aa/aa/' + 'a'.repeat(64),
  mime: 'image/png',
  sizeBytes: 100,
  width: 640,
  height: 480,
  uploadedBy: '00000000-0000-0000-0000-000000000001',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const AUTH_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'user@example.com',
  username: 'testuser',
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

const LIST_ID = '00000000-0000-0000-0000-000000000010'
const ITEM_ID = '00000000-0000-0000-0000-000000000020'
const LIST_ITEM_ID = '00000000-0000-0000-0000-000000000030'

const MOCK_LIST = {
  id: LIST_ID,
  occasionTypeId: null,
  title: 'My Wishlist',
  description: null,
  listStatus: 'active' as const,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const MOCK_COLLABORATOR = {
  id: '00000000-0000-0000-0000-000000000040',
  listId: LIST_ID,
  userId: AUTH_USER.id,
  invitedEmail: null,
  collabRole: 'owner' as const,
  inviteStatus: 'accepted',
  inviteToken: null,
  inviteTokenExpiresAt: null,
  acceptedAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const MOCK_EDITOR_COLLABORATOR = {
  ...MOCK_COLLABORATOR,
  id: '00000000-0000-0000-0000-000000000041',
  collabRole: 'editor' as const,
}

const MOCK_LIST_ITEM = {
  id: LIST_ITEM_ID,
  listId: LIST_ID,
  itemId: ITEM_ID,
  quantityDesired: 1,
  quantityReservedTotal: 0,
  itemStatus: 'available',
  sortOrder: null,
  creatorNote: null,
  imageId: null,
  image: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const ACCESS_TOKEN_ENTRY = makeAccessTokenEntry(AUTH_USER.id)

const MOCK_ITEM = {
  id: ITEM_ID,
  name: 'Test Item',
  description: null,
  imageUrl: null,
  createdByUserId: AUTH_USER.id,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

function mockAuthChain(): void {
  vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
  vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)
}

function mockListItemOwnershipChain(): void {
  vi.mocked(db.query.listItems.findFirst).mockResolvedValue(MOCK_LIST_ITEM as never)
  vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
    { ...MOCK_LIST, collaborators: [{ userId: AUTH_USER.id, user: AUTH_USER }] } as never,
  )
  vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(MOCK_COLLABORATOR as never)
}

describe('POST /v1/list-items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProcessOptionalImage.mockResolvedValue({ image: null })
    mockCleanupReplacedImage.mockResolvedValue(undefined)
  })

  it('returns 201 with created list item for JSON body', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      { ...MOCK_LIST, collaborators: [{ userId: AUTH_USER.id, user: AUTH_USER }] } as never,
    )
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(MOCK_COLLABORATOR as never)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM as never)
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([MOCK_LIST_ITEM]),
      }),
    } as never)

    const response = await apiRequest('/v1/list-items', {
      method: 'POST',
      token,
      body: { listId: LIST_ID, itemId: ITEM_ID, quantityDesired: 2 },
    })

    const body = await response.json() as { listItem: { listId: string; image: unknown } }
    expect(response.status).toBe(201)
    expect(body.listItem.listId).toBe(LIST_ID)
    expect(body.listItem.image).toBeNull()
  })

  it('returns 404 when the referenced item does not exist', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      { ...MOCK_LIST, collaborators: [{ userId: AUTH_USER.id, user: AUTH_USER }] } as never,
    )
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(MOCK_COLLABORATOR as never)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest('/v1/list-items', {
      method: 'POST',
      token,
      body: { listId: LIST_ID, itemId: ITEM_ID },
    })

    expect(response.status).toBe(404)
  })

  it('returns 403 when the user is not a contributor of the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(MOCK_LIST as never)
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest('/v1/list-items', {
      method: 'POST',
      token,
      body: { listId: LIST_ID, itemId: ITEM_ID },
    })

    expect(response.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest('/v1/list-items', {
      method: 'POST',
      body: { listId: LIST_ID, itemId: ITEM_ID },
    })

    expect(response.status).toBe(401)
  })

  it('returns 422 when listId is not a UUID', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      { ...MOCK_LIST, collaborators: [{ userId: AUTH_USER.id, user: AUTH_USER }] } as never,
    )
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(MOCK_COLLABORATOR as never)

    const response = await apiRequest('/v1/list-items', {
      method: 'POST',
      token,
      body: { listId: 'not-a-uuid', itemId: ITEM_ID },
    })

    expect(response.status).toBe(422)
  })

  it('creates a list item with imageId when multipart body carries an image', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      { ...MOCK_LIST, collaborators: [{ userId: AUTH_USER.id, user: AUTH_USER }] } as never,
    )
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(MOCK_COLLABORATOR as never)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM as never)
    mockProcessOptionalImage.mockResolvedValueOnce({ image: MOCK_IMAGE_ROW })
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([{ ...MOCK_LIST_ITEM, imageId: MOCK_IMAGE_ROW.id }]),
      }),
    } as never)
    vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(
      { ...MOCK_LIST_ITEM, imageId: MOCK_IMAGE_ROW.id, image: MOCK_IMAGE_ROW } as never,
    )

    const response = await apiMultipartRequest('/v1/list-items', {
      method: 'POST',
      token,
      fields: { listId: LIST_ID, itemId: ITEM_ID, quantityDesired: '3' },
      image: { buffer: Buffer.from([1, 2, 3, 4]) },
    })

    const body = (await response.json()) as {
      listItem: { imageId: string | null; image: { urls: { sm: string; md: string; lg: string } } | null }
    }
    expect(response.status).toBe(201)
    expect(mockProcessOptionalImage).toHaveBeenCalledTimes(1)
    expect(body.listItem.imageId).toBe(MOCK_IMAGE_ROW.id)
    expect(body.listItem.image?.urls.sm).toContain('-300.webp')
  })

  it('propagates INVALID_IMAGE_TYPE from the pipeline on multipart create', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      { ...MOCK_LIST, collaborators: [{ userId: AUTH_USER.id, user: AUTH_USER }] } as never,
    )
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(MOCK_COLLABORATOR as never)
    vi.mocked(db.query.items.findFirst).mockResolvedValueOnce(MOCK_ITEM as never)
    const { ErrorCode } = await import('../../shared/enums/error-code.js')
    mockProcessOptionalImage.mockResolvedValueOnce({ errorCode: ErrorCode.INVALID_IMAGE_TYPE })

    const response = await apiMultipartRequest('/v1/list-items', {
      method: 'POST',
      token,
      fields: { listId: LIST_ID, itemId: ITEM_ID },
      image: { buffer: Buffer.from([1, 2, 3, 4]) },
    })

    expect(response.status).toBe(400)
  })
})

describe('PATCH /v1/list-items/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProcessOptionalImage.mockResolvedValue({ image: null })
    mockCleanupReplacedImage.mockResolvedValue(undefined)
  })

  it('deletes the previous image row when the stored image is cleared', async () => {
    const PREVIOUS_IMAGE_ID = '00000000-0000-0000-0000-0000000000bb'
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValue(
      { ...MOCK_LIST_ITEM, imageId: PREVIOUS_IMAGE_ID } as never,
    )
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      { ...MOCK_LIST, collaborators: [{ userId: AUTH_USER.id, user: AUTH_USER }] } as never,
    )
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(MOCK_COLLABORATOR as never)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([{ ...MOCK_LIST_ITEM, imageId: null }]),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { clearImage: true },
    })

    expect(response.status).toBe(200)
    expect(mockCleanupReplacedImage).toHaveBeenCalledWith(
      PREVIOUS_IMAGE_ID,
      null,
      'list_item.update',
    )
  })

  it('rejects a multipart body combining clearImage=true with an image part (422)', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListItemOwnershipChain()

    const response = await apiMultipartRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      fields: { clearImage: 'true' },
      image: { buffer: Buffer.from([1, 2, 3, 4]) },
    })

    expect(response.status).toBe(422)
    expect(mockProcessOptionalImage).not.toHaveBeenCalled()
  })

  it('returns 200 with updated list item', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListItemOwnershipChain()

    const updatedListItem = { ...MOCK_LIST_ITEM, quantityDesired: 3 }
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([updatedListItem]),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { quantityDesired: 3 },
    })

    const body = await response.json() as { listItem: { quantityDesired: number } }
    expect(response.status).toBe(200)
    expect(body.listItem.quantityDesired).toBe(3)
  })

  it('returns 200 when updating creatorNote to null', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListItemOwnershipChain()

    const updatedListItem = { ...MOCK_LIST_ITEM, creatorNote: null }
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([updatedListItem]),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { creatorNote: null },
    })

    expect(response.status).toBe(200)
  })

  it('returns 200 and persists imageId=null when clearImage=true', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListItemOwnershipChain()

    const setMock = vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([{ ...MOCK_LIST_ITEM, imageId: null }]),
      }),
    })
    vi.mocked(db.update).mockReturnValueOnce({ set: setMock } as never)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { clearImage: true },
    })

    expect(response.status).toBe(200)
    expect(setMock).toHaveBeenCalledOnce()
    const patch = setMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch.imageId).toBeNull()
  })

  it('returns 200 when user is an editor of the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValue(MOCK_LIST_ITEM as never)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(MOCK_LIST as never)
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(MOCK_EDITOR_COLLABORATOR as never)

    const updatedListItem = { ...MOCK_LIST_ITEM, quantityDesired: 5 }
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([updatedListItem]),
        }),
      }),
    } as never)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { quantityDesired: 5 },
    })

    const body = await response.json() as { listItem: { quantityDesired: number } }
    expect(response.status).toBe(200)
    expect(body.listItem.quantityDesired).toBe(5)
  })

  it('returns 403 when user is not a contributor of the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(MOCK_LIST_ITEM as never)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(MOCK_LIST as never)
    vi.mocked(db.query.listCollaborators.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { quantityDesired: 3 },
    })

    expect(response.status).toBe(403)
  })

  it('returns 404 when list item does not exist', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: { quantityDesired: 3 },
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 NO_FIELDS_TO_UPDATE when body is empty', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListItemOwnershipChain()

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      token,
      body: {},
    })

    const body = await response.json() as { code: string }
    expect(response.status).toBe(422)
    expect(body.code).toBe('NO_FIELDS_TO_UPDATE')
  })

  it('returns 422 when id param is not a uuid', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)

    const response = await apiRequest('/v1/list-items/not-a-uuid', {
      method: 'PATCH',
      token,
      body: { quantityDesired: 1 },
    })

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'PATCH',
      body: { quantityDesired: 1 },
    })

    expect(response.status).toBe(401)
  })
})

describe('DELETE /v1/list-items/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCleanupReplacedImage.mockResolvedValue(undefined)
  })

  it('cleans up the attached image row when a list item carrying an image is deleted', async () => {
    const DELETED_IMAGE_ID = '00000000-0000-0000-0000-0000000000cc'
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListItemOwnershipChain()
    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([{ ...MOCK_LIST_ITEM, imageId: DELETED_IMAGE_ID }]),
      }),
    } as never)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(200)
    expect(mockCleanupReplacedImage).toHaveBeenCalledWith(DELETED_IMAGE_ID, null, 'list_item.delete')
  })

  it('returns 200 with success message on delete', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    mockListItemOwnershipChain()

    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([MOCK_LIST_ITEM]),
      }),
    } as never)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'DELETE',
      token,
    })

    const body = await response.json() as { message: string }
    expect(response.status).toBe(200)
    expect(body.message).toBe('Item removed from list')
  })

  it('returns 403 when user is not owner of the list', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(MOCK_LIST_ITEM as never)
    vi.mocked(db.query.lists.findFirst).mockResolvedValueOnce(
      { ...MOCK_LIST, collaborators: [] } as never,
    )

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(403)
  })

  it('returns 404 when list item does not exist', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    mockAuthChain()
    vi.mocked(db.query.listItems.findFirst).mockResolvedValueOnce(undefined)

    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 when id param is not a uuid', async () => {
    const token = await generateTestToken(AUTH_USER.id)
    vi.mocked(db.query.accessTokens.findFirst).mockResolvedValue(ACCESS_TOKEN_ENTRY as never)
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(AUTH_USER)

    const response = await apiRequest('/v1/list-items/not-a-uuid', {
      method: 'DELETE',
      token,
    })

    expect(response.status).toBe(422)
  })

  it('returns 401 when not authenticated', async () => {
    const response = await apiRequest(`/v1/list-items/${LIST_ITEM_ID}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(401)
  })
})
