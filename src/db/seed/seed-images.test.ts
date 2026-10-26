import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { users } from '../entities/users/users.schema.js'
import { listItems } from '../entities/list-items/list-items.schema.js'

const FIXTURE_BYTES = Buffer.from('fake-jpeg-bytes-for-test')
const FIXTURE_HASH = '5ac7482002af06b53b3a8a457060813dd3bcc6b7ae1a2154e9a1494241bc6f7f'
const FIXTURE_FILE_KEY = `${FIXTURE_HASH.slice(0, 2)}/${FIXTURE_HASH.slice(2, 4)}/${FIXTURE_HASH}`
const USER_ID = '00000000-0000-0000-0000-00000000a001'
const IMAGE_ID = '00000000-0000-0000-0000-00000000b001'
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
  existingImage?: { id: string } | undefined
}

function stubDb(options: StubOptions): {
  db: unknown
  updateCalls: UpdateCall[]
} {
  const updateCalls: UpdateCall[] = []
  const db = {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(options.user),
      },
      listItems: {
        findFirst: vi.fn().mockResolvedValue(options.listItem),
      },
      images: {
        findFirst: vi.fn().mockResolvedValue(options.existingImage),
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
  return { db, updateCalls }
}

describe('seedImages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadFile.mockResolvedValue(FIXTURE_BYTES)
    mockProcessImage.mockResolvedValue({
      image: {
        id: IMAGE_ID,
        hash: FIXTURE_HASH,
        fileKey: FIXTURE_FILE_KEY,
        mime: 'image/jpeg',
        sizeBytes: FIXTURE_BYTES.length,
        width: 300,
        height: 300,
        uploadedBy: USER_ID,
        createdAt: new Date('2026-10-01T00:00:00Z'),
        updatedAt: new Date('2026-10-01T00:00:00Z'),
      },
    })
  })

  it('inserts an image row via processImage and attaches both FKs when the user+list_item exist', async () => {
    const { db, updateCalls } = stubDb({
      user: { id: USER_ID, avatarImageId: null },
      listItem: { id: LIST_ITEM_ID, imageId: null },
      existingImage: undefined,
    })
    const { seedImages } = await import('./seed-images.js')

    await seedImages(db as never)

    expect(mockReadFile).toHaveBeenCalledWith('src/db/seed/fixtures/sample-avatar.jpg')
    expect(mockProcessImage).toHaveBeenCalledWith(FIXTURE_BYTES, USER_ID)
    expect(updateCalls).toHaveLength(2)
    expect(updateCalls[0]).toEqual({ table: users, set: { avatarImageId: IMAGE_ID } })
    expect(updateCalls[1]).toEqual({ table: listItems, set: { imageId: IMAGE_ID } })
  })

  it('reuses the existing images row by hash and skips processImage on a repeat seed', async () => {
    const { db, updateCalls } = stubDb({
      user: { id: USER_ID, avatarImageId: IMAGE_ID },
      listItem: { id: LIST_ITEM_ID, imageId: IMAGE_ID },
      existingImage: { id: IMAGE_ID },
    })
    const { seedImages } = await import('./seed-images.js')

    await seedImages(db as never)

    expect(mockProcessImage).not.toHaveBeenCalled()
    expect(updateCalls).toEqual([])
  })

  it('reuses the existing images row by hash and still re-attaches the FKs when they drifted', async () => {
    const { db, updateCalls } = stubDb({
      user: { id: USER_ID, avatarImageId: null },
      listItem: { id: LIST_ITEM_ID, imageId: null },
      existingImage: { id: IMAGE_ID },
    })
    const { seedImages } = await import('./seed-images.js')

    await seedImages(db as never)

    expect(mockProcessImage).not.toHaveBeenCalled()
    expect(updateCalls).toHaveLength(2)
    expect(updateCalls[0]).toEqual({ table: users, set: { avatarImageId: IMAGE_ID } })
    expect(updateCalls[1]).toEqual({ table: listItems, set: { imageId: IMAGE_ID } })
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

  it('skips the FK updates when processImage returns an error outcome', async () => {
    mockProcessImage.mockResolvedValueOnce({ errorCode: ErrorCode.INVALID_IMAGE })
    const { db, updateCalls } = stubDb({
      user: { id: USER_ID, avatarImageId: null },
      listItem: { id: LIST_ITEM_ID, imageId: null },
      existingImage: undefined,
    })
    const { seedImages } = await import('./seed-images.js')

    await seedImages(db as never)

    expect(updateCalls).toEqual([])
  })
})

describe('getSeedImageFileKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadFile.mockResolvedValue(FIXTURE_BYTES)
  })

  it('returns the content-addressed file key (aa/bb/<64-hex-hash>) for the fixture bytes', async () => {
    const { getSeedImageFileKey } = await import('./seed-images.js')
    const fileKey = await getSeedImageFileKey()
    expect(fileKey).toMatch(/^[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{64}$/)
  })
})
