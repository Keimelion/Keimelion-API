import { HttpStatus } from '../../shared/enums/http.js'
import { serviceError } from '../../shared/utils/response.js'
import { logger } from '../../shared/utils/logger.js'
import { processImage } from './image.pipeline.js'
import { toImageDetail } from './images.mapper.js'
import { deleteImageById } from '../../db/entities/images/images.repository.js'
import type { ImageDetail } from './images.mapper.js'
import type { Image } from '../../db/entities/images/images.schema.js'
import type { ErrorCode } from '../../shared/enums/error-code.js'
import type { ServiceResult } from '../../shared/types/service.js'

export async function uploadImage(
  input: Buffer,
  uploadedBy: string,
): Promise<ServiceResult<{ image: ImageDetail }>> {
  const result = await processImage(input, uploadedBy)
  if ('errorCode' in result) return serviceError(result.errorCode)
  return { data: { image: toImageDetail(result.image) }, httpStatus: HttpStatus.CREATED }
}

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

export async function rollbackImage(imageId: string | null, context: string): Promise<void> {
  if (!imageId) return
  try {
    await deleteImageById(imageId)
  } catch (error: unknown) {
    logger.error({ error, imageId, context }, 'Failed to rollback image row')
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
