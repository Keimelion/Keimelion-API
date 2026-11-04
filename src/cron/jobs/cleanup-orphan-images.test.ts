import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../db/entities/images/images.repository.js', () => ({
  deleteUnreferencedImages: vi.fn(),
  findExistingImageHashes: vi.fn(),
  lockImageHash: vi.fn(),
}))

vi.mock('../../features/uploads/image.storage.js', () => ({
  deleteStoredImageFiles: vi.fn(),
  listStoredImageHashes: vi.fn(),
}))

vi.mock('../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { env } from '../../config/env.js'
import {
  deleteUnreferencedImages,
  findExistingImageHashes,
  lockImageHash,
} from '../../db/entities/images/images.repository.js'
import { deleteStoredImageFiles, listStoredImageHashes } from '../../features/uploads/image.storage.js'
import { logger } from '../../shared/utils/logger.js'
import { cleanupOrphanImages } from './cleanup-orphan-images.js'

const INTERVAL_MS = env.IMAGE_ORPHAN_CLEANUP_INTERVAL_MS
const ONE_HOUR_MS = 60 * 60 * 1000
const REFERENCED_HASH = 'a'.repeat(64)
const ORPHAN_HASH = 'b'.repeat(64)

describe('cleanup-orphan-images cron job', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.mocked(deleteUnreferencedImages).mockResolvedValue(0)
    vi.mocked(listStoredImageHashes).mockResolvedValue([])
    vi.mocked(findExistingImageHashes).mockResolvedValue(new Set())
  })

  afterEach(() => {
    cleanupOrphanImages.stop()
    vi.useRealTimers()
  })

  it('does not run at startup', () => {
    cleanupOrphanImages.start()

    expect(vi.mocked(deleteUnreferencedImages)).not.toHaveBeenCalled()
  })

  it('deletes unreferenced rows older than the grace period', async () => {
    vi.mocked(deleteUnreferencedImages).mockResolvedValueOnce(2)

    cleanupOrphanImages.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    const createdBefore = vi.mocked(deleteUnreferencedImages).mock.calls[0]?.[0]
    expect(createdBefore?.getTime()).toBe(Date.now() - env.IMAGE_ORPHAN_GRACE_HOURS * ONE_HOUR_MS)
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith({ deletedCount: 2 }, 'Orphan image cleanup completed')
  })

  it('deletes files of hashes no images row references, under the per-hash lock', async () => {
    vi.mocked(listStoredImageHashes).mockResolvedValueOnce([REFERENCED_HASH, ORPHAN_HASH])
    vi.mocked(findExistingImageHashes)
      .mockResolvedValueOnce(new Set([REFERENCED_HASH]))
      .mockResolvedValueOnce(new Set())

    cleanupOrphanImages.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(lockImageHash)).toHaveBeenCalledExactlyOnceWith(ORPHAN_HASH, expect.anything())
    expect(vi.mocked(deleteStoredImageFiles)).toHaveBeenCalledExactlyOnceWith(ORPHAN_HASH)
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      { deletedRows: 0, deletedFileHashes: 1 },
      'Orphan image cleanup breakdown',
    )
  })

  it('keeps the files when an upload reused the hash before the lock was acquired', async () => {
    vi.mocked(listStoredImageHashes).mockResolvedValueOnce([ORPHAN_HASH])
    vi.mocked(findExistingImageHashes)
      .mockResolvedValueOnce(new Set())
      .mockResolvedValueOnce(new Set([ORPHAN_HASH]))

    cleanupOrphanImages.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(deleteStoredImageFiles)).not.toHaveBeenCalled()
  })

  it('logs and continues with the next hash when deleting files fails', async () => {
    const otherOrphanHash = 'c'.repeat(64)
    vi.mocked(listStoredImageHashes).mockResolvedValueOnce([ORPHAN_HASH, otherOrphanHash])
    vi.mocked(deleteStoredImageFiles).mockRejectedValueOnce(new Error('EACCES'))

    cleanupOrphanImages.start()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)

    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.objectContaining({ hash: ORPHAN_HASH }),
      'Failed to delete orphan image files',
    )
    expect(vi.mocked(deleteStoredImageFiles)).toHaveBeenCalledWith(otherOrphanHash)
  })
})
