import { z } from 'zod'
import type { Context } from 'hono'
import type { ZodType, infer as zInfer } from 'zod'
import type { $ZodIssue } from 'zod/v4/core'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { logger } from '../../shared/utils/logger.js'

const JSON_CONTENT_TYPE = 'application/json'
const MULTIPART_CONTENT_TYPE = 'multipart/form-data'
const DEFAULT_IMAGE_FIELD = 'image'

export const multipartBoolSchema = z
  .enum(['true', 'false', '1', '0', 'yes', 'no'])
  .transform((raw) => raw === 'true' || raw === '1' || raw === 'yes')

export function isJsonRequest(context: Context): boolean {
  const contentType = context.req.header('Content-Type') ?? ''
  return contentType.toLowerCase().startsWith(JSON_CONTENT_TYPE)
}

export function isMultipartRequest(context: Context): boolean {
  const contentType = context.req.header('Content-Type') ?? ''
  return contentType.toLowerCase().startsWith(MULTIPART_CONTENT_TYPE)
}

interface ParsedMultipartFields {
  fields: Record<string, string>
  imageBuffer: Buffer | null
}

interface MultipartParseError {
  errorCode: ErrorCode
}

type MultipartParseResult = ParsedMultipartFields | MultipartParseError

export async function parseMultipartFields(
  context: Context,
  imageFieldName: string = DEFAULT_IMAGE_FIELD,
): Promise<MultipartParseResult> {
  let body: Record<string, unknown>
  try {
    body = (await context.req.parseBody())
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

interface ParseJsonOrMultipartOptions<JsonSchema extends ZodType, MultipartSchema extends ZodType> {
  jsonSchema: JsonSchema
  multipartSchema: MultipartSchema
  imageField?: string
}

export type ParsedJsonOrMultipart<JsonSchema extends ZodType, MultipartSchema extends ZodType> =
  | { ok: true; kind: 'json'; data: zInfer<JsonSchema>; imageBuffer: null }
  | { ok: true; kind: 'multipart'; data: zInfer<MultipartSchema>; imageBuffer: Buffer | null }
  | { ok: false; errorCode: ErrorCode; issues?: $ZodIssue[] }

export async function parseJsonOrMultipart<
  JsonSchema extends ZodType,
  MultipartSchema extends ZodType,
>(
  context: Context,
  options: ParseJsonOrMultipartOptions<JsonSchema, MultipartSchema>,
): Promise<ParsedJsonOrMultipart<JsonSchema, MultipartSchema>> {
  if (isMultipartRequest(context)) {
    const parsed = await parseMultipartFields(context, options.imageField ?? DEFAULT_IMAGE_FIELD)
    if ('errorCode' in parsed) return { ok: false, errorCode: parsed.errorCode }
    const result = options.multipartSchema.safeParse(parsed.fields)
    if (!result.success) {
      return { ok: false, errorCode: ErrorCode.UNPROCESSABLE_ENTITY, issues: result.error.issues }
    }
    return {
      ok: true,
      kind: 'multipart',
      data: result.data,
      imageBuffer: parsed.imageBuffer,
    }
  }

  let payload: unknown
  try {
    payload = await context.req.json()
  } catch {
    return { ok: false, errorCode: ErrorCode.BAD_REQUEST }
  }
  const result = options.jsonSchema.safeParse(payload)
  if (!result.success) {
    return { ok: false, errorCode: ErrorCode.UNPROCESSABLE_ENTITY, issues: result.error.issues }
  }
  return {
    ok: true,
    kind: 'json',
    data: result.data,
    imageBuffer: null,
  }
}
