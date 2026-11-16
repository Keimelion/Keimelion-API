import { ErrorCode } from '@keimelion/sdk/enums'
import { findPgConstraintName, isPgUniqueViolation, isPgForeignKeyViolation } from '../db/pg-errors.js'

export type WriteOutcome<T> = { row: T } | { errorCode: ErrorCode }

interface RunWriteOptions {
  fallbackErrorCode?: ErrorCode
  uniqueErrorCodeByConstraint?: Readonly<Record<string, ErrorCode>>
  foreignKeyErrorCode?: ErrorCode
}

export async function runWrite<T>(
  op: () => Promise<T | undefined>,
  options?: RunWriteOptions,
): Promise<WriteOutcome<T>> {
  const fallback = options?.fallbackErrorCode ?? ErrorCode.INTERNAL_ERROR
  try {
    const row = await op()
    if (!row) return { errorCode: fallback }
    return { row }
  } catch (error) {
    if (isPgUniqueViolation(error)) return { errorCode: resolveUniqueErrorCode(error, options) }
    if (options?.foreignKeyErrorCode !== undefined && isPgForeignKeyViolation(error)) {
      return { errorCode: options.foreignKeyErrorCode }
    }
    return { errorCode: fallback }
  }
}

function resolveUniqueErrorCode(error: unknown, options: RunWriteOptions | undefined): ErrorCode {
  const constraintName = findPgConstraintName(error)
  if (constraintName === null) return ErrorCode.CONFLICT
  return options?.uniqueErrorCodeByConstraint?.[constraintName] ?? ErrorCode.CONFLICT
}

interface BuildChangesOptions {
  redactFields?: Set<string>
  redactedValue?: string
}

export function buildChanges(
  existing: object,
  patch: object,
  options?: BuildChangesOptions,
): Record<string, { from: unknown; to: unknown }> {
  const redactFields = options?.redactFields
  const redactedValue = options?.redactedValue ?? '<redacted>'
  const source = existing as Record<string, unknown>
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const [key, value] of Object.entries(patch)) {
    const isRedacted = redactFields?.has(key) ?? false
    changes[key] = {
      from: isRedacted ? redactedValue : source[key],
      to: isRedacted ? redactedValue : value,
    }
  }
  return changes
}
