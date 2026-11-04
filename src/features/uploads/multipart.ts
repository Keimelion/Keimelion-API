import { z } from 'zod'
import type { Context } from 'hono'
import type { ZodType, infer as zInfer } from 'zod'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { logger } from '../../shared/utils/logger.js'
import { sendError } from '../../shared/utils/response.js'
import { mapZodIssues } from '../../shared/utils/validation.js'
import type { ValidationIssue } from '../../shared/utils/validation.js'

const JSON_CONTENT_TYPE = 'application/json'
const MULTIPART_CONTENT_TYPE = 'multipart/form-data'
const DEFAULT_IMAGE_FIELD = 'image'
const INVALID_JSON_FIELD_MESSAGE = 'Expected a JSON-encoded value'
const UNSUPPORTED_FIELD_VALUE_MESSAGE =
  'Multipart fields must be sent once as plain text; only the image field may carry a file'
const UNSUPPORTED_FIELD_VALUE_CODE = 'custom'

export const multipartBoolSchema = z
  .enum(['true', 'false', '1', '0', 'yes', 'no'])
  .transform((raw) => raw === 'true' || raw === '1' || raw === 'yes')

export function multipartJsonSchema<Inner extends ZodType>(
  inner: Inner,
): z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<unknown, string>>, Inner> {
  return z
    .string()
    .transform((raw, context) => {
      try {
        return JSON.parse(raw) as unknown
      } catch {
        context.addIssue({ code: 'custom', message: INVALID_JSON_FIELD_MESSAGE })
        return z.NEVER
      }
    })
    .pipe(inner)
}

export function multipartEmptyAsNullSchema<Inner extends ZodType<unknown, string | null>>(
  inner: Inner,
): z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<string | null, string>>, Inner> {
  return z
    .string()
    .transform((raw) => (raw === '' ? null : raw))
    .pipe(inner)
}

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
  issues?: ValidationIssue[]
}

type MultipartParseResult = ParsedMultipartFields | MultipartParseError

export async function parseMultipartFields(
  context: Context,
  imageFieldName: string = DEFAULT_IMAGE_FIELD,
): Promise<MultipartParseResult> {
  let body: Record<string, unknown>
  try {
    body = await context.req.parseBody({ all: true })
  } catch (error: unknown) {
    logger.warn({ error }, 'Malformed multipart body')
    return { errorCode: ErrorCode.BAD_REQUEST }
  }

  const entries = Object.entries(body)
  const issues = entries
    .filter(([key, value]) => !isSupportedFieldValue(key, value, imageFieldName))
    .map(([key]) => toUnsupportedFieldIssue(key))
  if (issues.length > 0) return { errorCode: ErrorCode.UNPROCESSABLE_ENTITY, issues }

  const fields = Object.fromEntries(
    entries.filter(
      (entry): entry is [string, string] => entry[0] !== imageFieldName && typeof entry[1] === 'string',
    ),
  )
  const imageValue = body[imageFieldName]
  if (imageValue === undefined) return { fields, imageBuffer: null }

  const imageBuffer = await extractImageBuffer(imageValue)
  if (!imageBuffer) return { errorCode: ErrorCode.INVALID_IMAGE }
  return { fields, imageBuffer }
}

function isSupportedFieldValue(key: string, value: unknown, imageFieldName: string): boolean {
  if (Array.isArray(value)) return false
  return key === imageFieldName || typeof value === 'string'
}

function toUnsupportedFieldIssue(key: string): ValidationIssue {
  return { path: key, message: UNSUPPORTED_FIELD_VALUE_MESSAGE, code: UNSUPPORTED_FIELD_VALUE_CODE }
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
  | ParseFailure

interface ParseFailure {
  ok: false
  errorCode: ErrorCode
  issues?: ValidationIssue[]
}

export async function parseJsonOrMultipart<
  JsonSchema extends ZodType,
  MultipartSchema extends ZodType,
>(
  context: Context,
  options: ParseJsonOrMultipartOptions<JsonSchema, MultipartSchema>,
): Promise<ParsedJsonOrMultipart<JsonSchema, MultipartSchema>> {
  if (isMultipartRequest(context)) {
    const parsed = await parseMultipartFields(context, options.imageField ?? DEFAULT_IMAGE_FIELD)
    if ('errorCode' in parsed) return { ok: false, ...parsed }
    const result = options.multipartSchema.safeParse(parsed.fields)
    if (!result.success) {
      return { ok: false, errorCode: ErrorCode.UNPROCESSABLE_ENTITY, issues: mapZodIssues(result.error) }
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
    return { ok: false, errorCode: ErrorCode.UNPROCESSABLE_ENTITY, issues: mapZodIssues(result.error) }
  }
  return {
    ok: true,
    kind: 'json',
    data: result.data,
    imageBuffer: null,
  }
}

export function sendParseFailure(failure: ParseFailure): Response {
  return sendError(failure.errorCode, failure.issues ? { issues: failure.issues } : {})
}
