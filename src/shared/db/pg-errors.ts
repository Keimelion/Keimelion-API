// PostgreSQL SQLSTATE codes
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_UNIQUE_VIOLATION = '23505'
const PG_FOREIGN_KEY_VIOLATION = '23503'
const MAX_CAUSE_DEPTH = 5

export function isPgUniqueViolation(error: unknown): boolean {
  return hasPgErrorCode(error, PG_UNIQUE_VIOLATION)
}

export function isPgForeignKeyViolation(error: unknown): boolean {
  return hasPgErrorCode(error, PG_FOREIGN_KEY_VIOLATION)
}

function hasPgErrorCode(error: unknown, code: string, depth = 0): boolean {
  if (depth > MAX_CAUSE_DEPTH) return false
  if (typeof error !== 'object' || error === null) return false
  if ('code' in error && error.code === code) return true
  if ('cause' in error) return hasPgErrorCode(error.cause, code, depth + 1)
  return false
}
