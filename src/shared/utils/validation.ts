import type { Context } from 'hono'
import type { $ZodError } from 'zod/v4/core'
import { ErrorCode } from '@keimelion/sdk/enums'
import { VALIDATION_ROOT_PATH } from '@keimelion/sdk/schemas'
import type { ValidationIssueParsed } from '@keimelion/sdk/schemas'
import { errorMap } from './response.js'

type ValidationResult = { success: true } | { success: false; error: $ZodError }

export function validationErrorHandler(result: ValidationResult, c: Context): Response | undefined {
  if (!result.success) {
    const { status, message } = errorMap[ErrorCode.UNPROCESSABLE_ENTITY]
    const issues = mapZodIssues(result.error)
    return c.json(
      { message, code: ErrorCode.UNPROCESSABLE_ENTITY, metadata: { issues } },
      status,
    )
  }
  return undefined
}

export function mapZodIssues(error: $ZodError): ValidationIssueParsed[] {
  return error.issues.map((issue) => ({
    path: formatIssuePath(issue.path),
    message: issue.message,
    code: issue.code,
  }))
}

function formatIssuePath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return VALIDATION_ROOT_PATH
  return path.map(String).join('.')
}
