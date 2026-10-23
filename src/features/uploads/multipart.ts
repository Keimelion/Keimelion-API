import type { Context } from 'hono'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { logger } from '../../shared/utils/logger.js'

const JSON_CONTENT_TYPE = 'application/json'
const MULTIPART_CONTENT_TYPE = 'multipart/form-data'

export interface ParsedMultipart {
  fields: Record<string, string>
  imageBuffer: Buffer | null
}

export interface MultipartParseError {
  errorCode: ErrorCode
}

export type MultipartParseResult = ParsedMultipart | MultipartParseError

export function isJsonRequest(context: Context): boolean {
  const contentType = context.req.header('Content-Type') ?? ''
  return contentType.toLowerCase().startsWith(JSON_CONTENT_TYPE)
}

export function isMultipartRequest(context: Context): boolean {
  const contentType = context.req.header('Content-Type') ?? ''
  return contentType.toLowerCase().startsWith(MULTIPART_CONTENT_TYPE)
}

export async function parseMultipart(
  context: Context,
  imageFieldName: string,
): Promise<MultipartParseResult> {
  let body: Record<string, unknown>
  try {
    body = (await context.req.parseBody()) as Record<string, unknown>
  } catch (error: unknown) {
    logger.warn({ error }, 'Malformed multipart body')
    return { errorCode: ErrorCode.BAD_REQUEST }
  }

  const fields: Record<string, string> = {}
  let imageBuffer: Buffer | null = null

  for (const [key, value] of Object.entries(body)) {
    if (key === imageFieldName) {
      const buffer = await extractImageBuffer(value)
      if (!buffer) return { errorCode: ErrorCode.INVALID_IMAGE }
      imageBuffer = buffer
      continue
    }
    if (typeof value === 'string') {
      fields[key] = value
    }
  }

  return { fields, imageBuffer }
}

async function extractImageBuffer(value: unknown): Promise<Buffer | null> {
  if (typeof value === 'string') return null
  if (!isFileLike(value)) return null
  const arrayBuffer = await value.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (buffer.length === 0) return null
  return buffer
}

function isFileLike(value: unknown): value is Blob {
  return (
    value !== null &&
    typeof value === 'object' &&
    'arrayBuffer' in value &&
    typeof (value as Blob).arrayBuffer === 'function'
  )
}

export function parseBooleanField(raw: string | undefined): boolean {
  if (raw === undefined) return false
  const normalized = raw.toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}
