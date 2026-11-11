import { logger } from '../../shared/utils/logger.js'
import { processImage } from './image.pipeline.js'
import { deleteImageById } from '../../db/entities/images/images.repository.js'
import type { Image } from '../../db/entities/images/images.schema.js'
import type { ErrorCode } from '@keimelion/sdk/enums'

export type OptionalImageOutcome =
  | { image: Image | null }
  | { errorCode: ErrorCode }

export async function processOptionalImage(
  buffer: Buffer | null,
  uploadedBy: string,
): Promise<OptionalImageOutcome> {
  if (!buffer) return { image: null }
  const result = await processImage(buffer, uploadedBy)
  if ('errorCode' in result) return { errorCode: result.errorCode }
  return { image: result.image }
}

async function rollbackImage(imageId: string | null, context: string): Promise<void> {
  if (!imageId) return
  try {
    await deleteImageById(imageId)
  } catch (error: unknown) {
    logger.error({ error, imageId, context }, 'Failed to rollback image row')
  }
}

export async function runWithImageRollback<T>(
  imageId: string | null,
  context: string,
  write: () => Promise<T | undefined>,
): Promise<T | undefined> {
  try {
    const result = await write()
    if (result === undefined) await rollbackImage(imageId, context)
    return result
  } catch (error: unknown) {
    await rollbackImage(imageId, context)
    throw error
  }
}

// Deletes the previous image row when a parent entity replaces or clears its image.
// Files on disk stay (dedup makes them harmless; a separate orphan-file GC may sweep them).
export async function cleanupReplacedImage(
  previousImageId: string | null,
  currentImageId: string | null,
  context: string,
): Promise<void> {
  if (!previousImageId) return
  if (previousImageId === currentImageId) return
  try {
    await deleteImageById(previousImageId)
  } catch (error: unknown) {
    logger.error(
      { error, previousImageId, currentImageId, context },
      'Failed to cleanup replaced image row',
    )
  }
}
