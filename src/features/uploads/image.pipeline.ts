import { createHash } from 'crypto'
import { access, mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import type { Readable } from 'stream'
import sharp from 'sharp'
import { fileTypeFromBuffer } from 'file-type'
import { env } from '../../config/env.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { logger } from '../../shared/utils/logger.js'
import { insertImage } from '../../db/entities/images/images.repository.js'
import { IMAGE_VARIANT_WIDTHS } from './images.mapper.js'
import type { Image } from '../../db/entities/images/images.schema.js'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

const WEBP_QUALITY = 80

export interface ImagePipelineError {
  errorCode: ErrorCode
}

export interface ImagePipelineSuccess {
  image: Image
}

export type ImagePipelineResult = ImagePipelineError | ImagePipelineSuccess

export async function processImage(
  input: Buffer | Readable,
  uploadedBy: string,
): Promise<ImagePipelineResult> {
  const bufferResult = await collectWithSizeCap(input, env.UPLOADS_MAX_SIZE_BYTES)
  if ('errorCode' in bufferResult) return bufferResult

  const buffer = bufferResult.buffer
  if (buffer.length === 0) return { errorCode: ErrorCode.INVALID_IMAGE }

  const mime = await detectAllowedMime(buffer)
  if (!mime) return { errorCode: ErrorCode.INVALID_IMAGE_TYPE }

  const metadata = await readMetadata(buffer)
  if (!metadata) return { errorCode: ErrorCode.INVALID_IMAGE }

  const hash = sha256Hex(buffer)
  const fileKey = buildFileKey(hash)
  await writeAllVariants(buffer, fileKey)

  const image = await insertImage({
    hash,
    fileKey,
    mime,
    sizeBytes: buffer.length,
    width: metadata.width,
    height: metadata.height,
    uploadedBy,
  })
  if (!image) return { errorCode: ErrorCode.INTERNAL_ERROR }

  return { image }
}

async function collectWithSizeCap(
  input: Buffer | Readable,
  maxSizeBytes: number,
): Promise<{ buffer: Buffer } | ImagePipelineError> {
  if (Buffer.isBuffer(input)) {
    if (input.length > maxSizeBytes) return { errorCode: ErrorCode.PAYLOAD_TOO_LARGE }
    return { buffer: input }
  }
  return collectStreamWithCap(input, maxSizeBytes)
}

async function collectStreamWithCap(
  stream: Readable,
  maxSizeBytes: number,
): Promise<{ buffer: Buffer } | ImagePipelineError> {
  const chunks: Buffer[] = []
  let total = 0
  try {
    for await (const raw of stream) {
      const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array)
      total += chunk.length
      if (total > maxSizeBytes) {
        stream.destroy()
        return { errorCode: ErrorCode.PAYLOAD_TOO_LARGE }
      }
      chunks.push(chunk)
    }
  } catch (error: unknown) {
    logger.error({ error }, 'Failed to read image stream')
    return { errorCode: ErrorCode.INVALID_IMAGE }
  }
  return { buffer: Buffer.concat(chunks) }
}

async function detectAllowedMime(buffer: Buffer): Promise<AllowedMimeType | null> {
  const detected = await fileTypeFromBuffer(buffer)
  if (!detected) return null
  if (!isAllowedMime(detected.mime)) return null
  return detected.mime
}

function isAllowedMime(mime: string): mime is AllowedMimeType {
  return ALLOWED_MIME_TYPES.includes(mime as AllowedMimeType)
}

async function readMetadata(buffer: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const metadata = await sharp(buffer).metadata()
    if (!metadata.width || !metadata.height) return null
    return { width: metadata.width, height: metadata.height }
  } catch (error: unknown) {
    logger.warn({ error }, 'sharp metadata read failed')
    return null
  }
}

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function buildFileKey(hash: string): string {
  return `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`
}

async function writeAllVariants(buffer: Buffer, fileKey: string): Promise<void> {
  await Promise.all(
    Object.values(IMAGE_VARIANT_WIDTHS).map((width) => writeVariant(buffer, fileKey, width)),
  )
}

async function writeVariant(buffer: Buffer, fileKey: string, width: number): Promise<void> {
  const outputPath = join(env.UPLOADS_DIR, `${fileKey}-${String(width)}.webp`)
  if (await fileExists(outputPath)) return
  await mkdir(dirname(outputPath), { recursive: true })
  await sharp(buffer)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outputPath)
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
