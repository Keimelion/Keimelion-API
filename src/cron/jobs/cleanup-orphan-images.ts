import { env } from '../../config/env.js'
import { db } from '../../db/client.js'
import {
  deleteUnreferencedImages,
  findExistingImageHashes,
  lockImageHash,
} from '../../db/entities/images/images.repository.js'
import { deleteStoredImageFiles, listStoredImageHashes } from '../../features/uploads/image.storage.js'
import { logger } from '../../shared/utils/logger.js'
import { createCronJob } from '../create-cron-job.js'

const ONE_HOUR_MS = 60 * 60 * 1000
const HASH_LOOKUP_BATCH_SIZE = 500

// 1. Deletes images rows that no item nor user references anymore (replaced, cleared, parent
//    deleted…) and that no pending report keeps as evidence, once they are older than the grace
//    period so an upload still being attached to its parent is left alone.
// 2. Deletes webp files whose hash no images row references anymore.
async function runOrphanImageCleanup(): Promise<number> {
  const createdBefore = new Date(Date.now() - env.IMAGE_ORPHAN_GRACE_HOURS * ONE_HOUR_MS)
  const deletedRows = await deleteUnreferencedImages(createdBefore)
  const deletedFileHashes = await deleteUnreferencedFiles()
  logger.info({ deletedRows, deletedFileHashes }, 'Orphan image cleanup breakdown')
  return deletedRows + deletedFileHashes
}

async function deleteUnreferencedFiles(): Promise<number> {
  const storedHashes = await listStoredImageHashes()
  let deletedCount = 0

  for (let start = 0; start < storedHashes.length; start += HASH_LOOKUP_BATCH_SIZE) {
    const batch = storedHashes.slice(start, start + HASH_LOOKUP_BATCH_SIZE)
    const referenced = await findExistingImageHashes(batch)
    for (const hash of batch.filter((candidate) => !referenced.has(candidate))) {
      if (await deleteFilesIfStillUnreferenced(hash)) deletedCount++
    }
  }

  return deletedCount
}

// Re-checks under the per-hash lock: an upload of the same content may have reused the files
// between the batch lookup and now.
async function deleteFilesIfStillUnreferenced(hash: string): Promise<boolean> {
  try {
    return await db.transaction(async (tx) => {
      await lockImageHash(hash, tx)
      const referenced = await findExistingImageHashes([hash], tx)
      if (referenced.size > 0) return false
      await deleteStoredImageFiles(hash)
      return true
    })
  } catch (error: unknown) {
    logger.error({ error, hash }, 'Failed to delete orphan image files')
    return false
  }
}

export const cleanupOrphanImages = createCronJob({
  name: 'Orphan image cleanup',
  intervalMs: env.IMAGE_ORPHAN_CLEANUP_INTERVAL_MS,
  run: runOrphanImageCleanup,
})
