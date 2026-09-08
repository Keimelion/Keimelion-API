import { ilike, isNotNull, isNull, type AnyColumn, type SQL } from 'drizzle-orm'

export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export function nullnessFlag(
  column: AnyColumn,
  flag: boolean | undefined,
  defaultValue?: boolean,
): SQL | undefined {
  const effective = flag ?? defaultValue
  if (effective === undefined) return undefined
  return effective ? isNotNull(column) : isNull(column)
}

export function stringContains(column: AnyColumn, value: string | undefined): SQL | undefined {
  if (value === undefined) return undefined
  return ilike(column, `%${escapeIlikePattern(value)}%`)
}
