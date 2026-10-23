import { HttpStatus } from '../../shared/enums/http.js'
import { serviceError } from '../../shared/utils/response.js'
import { processImage } from './image.pipeline.js'
import { toImageDetail } from './images.mapper.js'
import type { ImageDetail } from './images.mapper.js'
import type { ServiceResult } from '../../shared/types/service.js'

export async function uploadImage(
  input: Buffer,
  uploadedBy: string,
): Promise<ServiceResult<{ image: ImageDetail }>> {
  const result = await processImage(input, uploadedBy)
  if ('errorCode' in result) return serviceError(result.errorCode)
  return { data: { image: toImageDetail(result.image) }, httpStatus: HttpStatus.CREATED }
}
