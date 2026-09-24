import { ErrorCode } from '../enums/error-code.js'
import { isPgUniqueViolation } from '../db/pg-errors.js'

export type WriteOutcome<T> = { row: T } | { errorCode: ErrorCode }

interface RunWriteOptions {
  fallbackErrorCode?: ErrorCode
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
    if (isPgUniqueViolation(error)) return { errorCode: ErrorCode.CONFLICT }
    return { errorCode: fallback }
  }
}

interface BuildChangesOptions {
  redactFields?: Set<string>
  redactedValue?: string
}

export function buildChanges<T extends Record<string, unknown>>(
  existing: T,
  patch: Partial<T>,
  options?: BuildChangesOptions,
): Record<string, { from: unknown; to: unknown }> {
  const redactFields = options?.redactFields
  const redactedValue = options?.redactedValue ?? '<redacted>'
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const [key, value] of Object.entries(patch)) {
    const isRedacted = redactFields?.has(key) ?? false
    changes[key] = {
      from: isRedacted ? redactedValue : existing[key as keyof T],
      to: isRedacted ? redactedValue : value,
    }
  }
  return changes
}
