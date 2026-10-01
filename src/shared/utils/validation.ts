import type { Context } from 'hono'
import type { ZodError } from 'zod'
import { ErrorCode } from '../enums/error-code.js'
import { errorMap } from './response.js'

const ROOT_PATH = '<root>'

interface ValidationIssue {
  path: string
  message: string
  code: string
}

type ValidationResult = { success: true } | { success: false; error: ZodError }

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

function mapZodIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: formatIssuePath(issue.path),
    message: issue.message,
    code: issue.code,
  }))
}

function formatIssuePath(path: readonly (string | number)[]): string {
  if (path.length === 0) return ROOT_PATH
  return path.map(String).join('.')
}
