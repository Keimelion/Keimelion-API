import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { users } from '../entities/users/users.schema.js'
import { listItems } from '../entities/list-items/list-items.schema.js'

const AVATAR_FIXTURE_PATH = 'src/db/seed/fixtures/sample-avatar.jpg'
const PRODUCT_FIXTURE_PATH = 'src/db/seed/fixtures/sample-product.jpg'
const AVATAR_BYTES = Buffer.from('fake-avatar-bytes')
const PRODUCT_BYTES = Buffer.from('fake-product-bytes')
const AVATAR_HASH = '0e6a0f7bb44f1c8f4e36a0a7f1a4a9d4c7a7b5f3c5f8e4d2b1a7c9d6e8f0a1b2c'
const PRODUCT_HASH = '1f7b1f8cc55f2d9f5f47b1b8f2b5bae5d8b8c6f4d6f9e5d3c2b8dae7f9f1b2c3d'
const USER_ID = '00000000-0000-0000-0000-00000000a001'
const AVATAR_IMAGE_ID = '00000000-0000-0000-0000-00000000b001'
const PRODUCT_IMAGE_ID = '00000000-0000-0000-0000-00000000b002'
const LIST_ITEM_ID = '7d3f0b40-0005-4b60-8000-000000000001'

const mockReadFile = vi.fn()
const mockProcessImage = vi.fn()

vi.mock('fs/promises', () => ({ readFile: mockReadFile }))
vi.mock('../../features/uploads/image.pipeline.js', () => ({ processImage: mockProcessImage }))

interface SeedUserRow {
  id: string
  avatarImageId: string | null
}

interface SeedListItemRow {
  id: string
  imageId: string | null
}

interface UpdateCall {
  table: unknown
  set: Record<string, unknown>
}

interface StubOptions {
  user: SeedUserRow | undefined
  listItem: SeedListItemRow | undefined
  existingAvatarImage?: { id: string } | undefined
  existingProductImage?: { id: string } | undefined
}

function stubDb(options: StubOptions): {
  db: unknown
  updateCalls: UpdateCall[]
} {
  const updateCalls: UpdateCall[] = []
  const imagesFindFirst = vi.fn().mockImplementation(() => Promise.resolve(undefined))
  const db = {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(options.user),
      },
      listItems: {
        findFirst: vi.fn().mockResolvedValue(options.listItem),
      },
      images: {
        findFirst: imagesFindFirst,
      },
    },
    update: vi.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          updateCalls.push({ table, set: values })
          return Promise.resolve()
        },
      }),
    })),
  }
  imagesFindFirst
    .mockResolvedValueOnce(options.existingAvatarImage)
    .mockResolvedValueOnce(options.existingProductImage)
  return { db, updateCalls }
}

function stubReadFile(): void {
  mockReadFile.mockImplementation((path: string) => {
    if (path === AVATAR_FIXTURE_PATH) return Promise.resolve(AVATAR_BYTES)
    if (path === PRODUCT_FIXTURE_PATH) return Promise.resolve(PRODUCT_BYTES)
    return Promise.reject(new Error(`unexpected read: ${path}`))
  })
}

function stubProcessImage(): void {
  mockProcessImage.mockImplementation((buffer: Buffer, uploadedBy: string) => {
    const isAvatar = buffer.equals(AVATAR_BYTES)
    return Promise.resolve({
      image: {
        id: isAvatar ? AVATAR_IMAGE_ID : PRODUCT_IMAGE_ID,
        hash: isAvatar ? AVATAR_HASH : PRODUCT_HASH,
        fileKey: 'xx/yy/zz',
        mime: 'image/jpeg',
        sizeBytes: buffer.length,
        width: 300,
        height: 300,
        uploadedBy,
        createdAt: new Date('2026-10-01T00:00:00Z'),
        updatedAt: new Date('2026-10-01T00:00:00Z'),
      },
    })
  })
}

describe('seedImages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubReadFile()
    stubProcessImage()
  })

  it('processes both fixtures via processImage and attaches avatar+product FKs on a fresh DB', async () => {
    const { db, updateCalls } = stubDb({
      user: { id: USER_ID, avatarImageId: null },
      listItem: { id: LIST_ITEM_ID, imageId: null },
    })
    const { seedImages } = await import('./seed-images.js')

    await seedImages(db as never)

    expect(mockReadFile).toHaveBeenCalledWith(AVATAR_FIXTURE_PATH)
    expect(mockReadFile).toHaveBeenCalledWith(PRODUCT_FIXTURE_PATH)
    expect(mockProcessImage).toHaveBeenCalledTimes(2)
    expect(mockProcessImage).toHaveBeenCalledWith(AVATAR_BYTES, USER_ID)
    expect(mockProcessImage).toHaveBeenCalledWith(PRODUCT_BYTES, USER_ID)
    expect(updateCalls).toHaveLength(2)
    expect(updateCalls[0]).toEqual({ table: users, set: { avatarImageId: AVATAR_IMAGE_ID } })
    expect(updateCalls[1]).toEqual({ table: listItems, set: { imageId: PRODUCT_IMAGE_ID } })
  })

  it('reuses existing images rows by hash and skips processImage on a repeat seed', async () => {
    const { db, updateCalls } = stubDb({
      user: { id: USER_ID, avatarImageId: AVATAR_IMAGE_ID },
      listItem: { id: LIST_ITEM_ID, imageId: PRODUCT_IMAGE_ID },
      existingAvatarImage: { id: AVATAR_IMAGE_ID },
      existingProductImage: { id: PRODUCT_IMAGE_ID },
    })
    const { seedImages } = await import('./seed-images.js')

    await seedImages(db as never)

    expect(mockProcessImage).not.toHaveBeenCalled()
    expect(updateCalls).toEqual([])
  })

  it('reuses existing images rows and still re-attaches FKs when they drifted', async () => {
    const { db, updateCalls } = stubDb({
      user: { id: USER_ID, avatarImageId: null },
      listItem: { id: LIST_ITEM_ID, imageId: null },
      existingAvatarImage: { id: AVATAR_IMAGE_ID },
      existingProductImage: { id: PRODUCT_IMAGE_ID },
    })
    const { seedImages } = await import('./seed-images.js')

    await seedImages(db as never)

    expect(mockProcessImage).not.toHaveBeenCalled()
    expect(updateCalls).toHaveLength(2)
    expect(updateCalls[0]).toEqual({ table: users, set: { avatarImageId: AVATAR_IMAGE_ID } })
    expect(updateCalls[1]).toEqual({ table: listItems, set: { imageId: PRODUCT_IMAGE_ID } })
  })

  it('returns silently without calling processImage when the seed user is missing', async () => {
    const { db, updateCalls } = stubDb({
      user: undefined,
      listItem: { id: LIST_ITEM_ID, imageId: null },
    })
    const { seedImages } = await import('./seed-images.js')

    await seedImages(db as never)

    expect(mockProcessImage).not.toHaveBeenCalled()
    expect(updateCalls).toEqual([])
  })

  it('returns silently without calling processImage when the seed list_item is missing', async () => {
    const { db, updateCalls } = stubDb({
      user: { id: USER_ID, avatarImageId: null },
      listItem: undefined,
    })
    const { seedImages } = await import('./seed-images.js')

    await seedImages(db as never)

    expect(mockProcessImage).not.toHaveBeenCalled()
    expect(updateCalls).toEqual([])
  })

  it('skips the FK updates when the avatar pipeline returns an error outcome', async () => {
    mockProcessImage.mockReset()
    mockProcessImage.mockResolvedValueOnce({ errorCode: ErrorCode.INVALID_IMAGE })
    const { db, updateCalls } = stubDb({
      user: { id: USER_ID, avatarImageId: null },
      listItem: { id: LIST_ITEM_ID, imageId: null },
    })
    const { seedImages } = await import('./seed-images.js')

    await seedImages(db as never)

    expect(mockProcessImage).toHaveBeenCalledTimes(1)
    expect(updateCalls).toEqual([])
  })

  it('skips the FK updates when the product pipeline returns an error outcome', async () => {
    mockProcessImage.mockReset()
    mockProcessImage
      .mockResolvedValueOnce({
        image: {
          id: AVATAR_IMAGE_ID,
          hash: AVATAR_HASH,
          fileKey: 'xx/yy/zz',
          mime: 'image/jpeg',
          sizeBytes: AVATAR_BYTES.length,
          width: 300,
          height: 300,
          uploadedBy: USER_ID,
          createdAt: new Date('2026-10-01T00:00:00Z'),
          updatedAt: new Date('2026-10-01T00:00:00Z'),
        },
      })
      .mockResolvedValueOnce({ errorCode: ErrorCode.INVALID_IMAGE })
    const { db, updateCalls } = stubDb({
      user: { id: USER_ID, avatarImageId: null },
      listItem: { id: LIST_ITEM_ID, imageId: null },
    })
    const { seedImages } = await import('./seed-images.js')

    await seedImages(db as never)

    expect(mockProcessImage).toHaveBeenCalledTimes(2)
    expect(updateCalls).toEqual([])
  })
})

describe('getSeedImageFileKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubReadFile()
  })

  it('returns two content-addressed file keys (aa/bb/<64-hex-hash>) for the bundled fixtures', async () => {
    const { getSeedImageFileKeys } = await import('./seed-images.js')
    const keys = await getSeedImageFileKeys()
    expect(keys).toHaveLength(2)
    for (const key of keys) {
      expect(key).toMatch(/^[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{64}$/)
    }
    expect(keys[0]).not.toBe(keys[1])
  })
})
