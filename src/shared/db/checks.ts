import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  check,
  type CheckBuilder,
  integer,
  smallint,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * Declarative helpers for Postgres CHECK constraints and the varchar / integer
 * columns they protect. Keeps entity schemas free of inline `sql` templates and
 * provides a single source of truth for the invariants.
 *
 * Column constructors (`nonEmptyVarchar`, `slugVarchar`, `nonNegativeInt`,
 * `nonNegativeSmallInt`) return a plain Drizzle column; the matching CHECK is
 * attached table-side via `nonEmptyCheck`, `slugCheck`, `nonNegativeCheck`
 * inside the `pgTable` `extraConfig` array.
 *
 * Zod validators remain the first line of defence on API inputs (so clients
 * see a 422 with structured field errors). CHECKs catch anything that bypasses
 * the API: seed scripts, direct SQL, background jobs, admin console.
 */

/**
 * POSIX regex (Postgres `~` operator) matching our canonical slug shape.
 * Lowercase alphanumeric segments separated by single hyphens, no leading or
 * trailing hyphen, no empty string.
 */
export const SLUG_REGEX = '^[a-z0-9]+(-[a-z0-9]+)*$'

export const nonEmptyVarchar = (name: string, length: number) => varchar(name, { length })

export const slugVarchar = (name: string, length: number) => varchar(name, { length })

export const nonNegativeInt = (name: string) => integer(name)

export const nonNegativeSmallInt = (name: string) => smallint(name)

export const nonEmptyCheck = (column: AnyPgColumn, constraintName?: string): CheckBuilder =>
  check(constraintName ?? `${column.name}_non_empty_check`, sql`char_length(${column}) >= 1`)

export const slugCheck = (column: AnyPgColumn, constraintName?: string): CheckBuilder =>
  // Interpolate the regex as an inline SQL literal: CHECK expressions in DDL
  // cannot carry bind parameters, so the pattern must be baked into the SQL
  // text. The column reference stays a Drizzle `sql`${column}`` so the
  // generator keeps the proper table qualifier.
  check(
    constraintName ?? `${column.name}_slug_check`,
    sql`${column} ~ ${sql.raw(`'${SLUG_REGEX}'`)}`,
  )

export interface NonNegativeCheckOptions {
  readonly nullable?: boolean
  readonly constraintName?: string
}

export const nonNegativeCheck = (
  column: AnyPgColumn,
  options: NonNegativeCheckOptions = {},
): CheckBuilder => {
  const expression = options.nullable
    ? sql`${column} IS NULL OR ${column} >= 0`
    : sql`${column} >= 0`
  return check(options.constraintName ?? `${column.name}_non_negative_check`, expression)
}
