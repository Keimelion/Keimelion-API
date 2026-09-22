import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { parseFilterQuery } from './filter-parser.js'
import { buildFilterSchema } from './filter-schema.js'
import { buildGenericWhere, escapeIlikePattern } from './filter-where.js'
import type { FilterConfig } from './filter-config.js'
import type { AnyColumn } from 'drizzle-orm'

const mockColumn = { name: 'mock_column' } as unknown as AnyColumn
const mockColumnTwo = { name: 'mock_column_two' } as unknown as AnyColumn

interface TestEntity {
  email: string
  createdAt: Date
  role: string
  bannedAt: Date | null
  score: number
}

const testConfig: FilterConfig<TestEntity> = {
  email: { column: mockColumn, operators: ['eq', 'ilike'] },
  createdAt: { column: mockColumnTwo, operators: ['gte', 'lte', 'between', 'isNull'] },
  role: { column: mockColumn, operators: ['eq', 'in'] },
  bannedAt: { column: mockColumnTwo, operators: ['isNull'] },
  score: { column: mockColumn, operators: ['gte', 'lte', 'between'] },
}

const testSchema = buildFilterSchema(testConfig)

describe('parseFilterQuery', () => {
  it('parses a single bracket-nested filter', () => {
    const result = parseFilterQuery('http://localhost/v1/admin/users?email[eq]=test@example.com')
    expect(result).toEqual([{ field: 'email', operator: 'eq', value: 'test@example.com' }])
  })

  it('parses multiple filters on different fields', () => {
    const result = parseFilterQuery('http://localhost/v1/admin/users?email[ilike]=acme&createdAt[gte]=2024-01-01')
    expect(result).toHaveLength(2)
    expect(result).toContainEqual({ field: 'email', operator: 'ilike', value: 'acme' })
    expect(result).toContainEqual({ field: 'createdAt', operator: 'gte', value: '2024-01-01' })
  })

  it('parses a filter with an array value', () => {
    const result = parseFilterQuery('http://localhost/v1/admin/users?role[in][]=admin&role[in][]=moderator')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ field: 'role', operator: 'in', value: ['admin', 'moderator'] })
  })

  it('returns empty array when no bracket filters are present', () => {
    const result = parseFilterQuery('http://localhost/v1/admin/users?page=1&limit=10')
    expect(result).toEqual([])
  })

  it('returns empty array when query string is absent', () => {
    const result = parseFilterQuery('http://localhost/v1/admin/users')
    expect(result).toEqual([])
  })

  it('ignores top-level string values (non-bracket params)', () => {
    const result = parseFilterQuery('http://localhost/v1/admin/users?email=notbracket')
    expect(result).toEqual([])
  })

  it('ignores entries with non-string values', () => {
    const result = parseFilterQuery('http://localhost/v1/admin/users?bannedAt[isNull]=true')
    expect(result).toEqual([{ field: 'bannedAt', operator: 'isNull', value: 'true' }])
  })
})

describe('buildFilterSchema — whitelist enforcement', () => {
  it('passes validation for an allowed (field, op) pair', () => {
    const filters = [{ field: 'email', operator: 'eq', value: 'test@example.com' }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('rejects an unknown field regardless of operator', () => {
    const filters = [{ field: 'passwordHash', operator: 'eq', value: 'anything' }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(false)
    expect(JSON.stringify(result)).toContain('passwordHash')
  })

  it('rejects an operator not whitelisted for the given field', () => {
    const filters = [{ field: 'email', operator: 'gte', value: '2024-01-01' }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(false)
    expect(JSON.stringify(result)).toContain('gte')
  })

  it('rejects an operator that does not exist in the framework', () => {
    const filters = [{ field: 'email', operator: 'regex', value: '.*' }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('rejects a known field when it has only one allowed operator and a different op is sent', () => {
    const filters = [{ field: 'bannedAt', operator: 'eq', value: 'foo' }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('passes validation for ilike on email (whitelisted)', () => {
    const filters = [{ field: 'email', operator: 'ilike', value: '%acme%' }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('rejects ilike on role (not whitelisted for role)', () => {
    const filters = [{ field: 'role', operator: 'ilike', value: 'ad' }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('passes validation for in on role (whitelisted)', () => {
    const filters = [{ field: 'role', operator: 'in', value: ['admin', 'user'] }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('passes validation for between on createdAt (whitelisted)', () => {
    const filters = [{ field: 'createdAt', operator: 'between', value: ['2024-01-01', '2024-12-31'] }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('passes validation for isNull on bannedAt (whitelisted)', () => {
    const filters = [{ field: 'bannedAt', operator: 'isNull', value: 'true' }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('passes an empty array (no filters)', () => {
    const result = testSchema.safeParse([])
    expect(result.success).toBe(true)
  })

  it('passes validation for multiple allowed filters', () => {
    const filters = [
      { field: 'email', operator: 'ilike', value: 'acme' },
      { field: 'createdAt', operator: 'gte', value: '2024-01-01' },
      { field: 'bannedAt', operator: 'isNull', value: 'false' },
    ]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(true)
  })

  it('rejects between with a single scalar value (must be a two-element tuple)', () => {
    const filters = [{ field: 'score', operator: 'between', value: '10' }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('rejects between with a single-element array', () => {
    const filters = [{ field: 'score', operator: 'between', value: ['10'] }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('rejects between with three values', () => {
    const filters = [{ field: 'score', operator: 'between', value: ['10', '20', '30'] }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('rejects isNull with a value other than "true" or "false"', () => {
    const filters = [{ field: 'bannedAt', operator: 'isNull', value: 'whatever' }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('rejects in with a scalar value (must be an array)', () => {
    const filters = [{ field: 'role', operator: 'in', value: 'admin' }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('rejects in with an empty array', () => {
    const filters = [{ field: 'role', operator: 'in', value: [] }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })

  it('rejects eq with an array value (must be scalar)', () => {
    const filters = [{ field: 'email', operator: 'eq', value: ['a', 'b'] }]
    const result = testSchema.safeParse(filters)
    expect(result.success).toBe(false)
  })
})

describe('buildGenericWhere', () => {
  it('returns undefined for empty filters array', () => {
    const result = buildGenericWhere(testConfig, [])
    expect(result).toBeUndefined()
  })

  it('returns a SQL object for a single filter', () => {
    const filters = [{ field: 'email', operator: 'eq', value: 'test@example.com' }]
    const result = buildGenericWhere(testConfig, filters)
    expect(result).toBeDefined()
  })

  it('returns a SQL object for multiple filters', () => {
    const filters = [
      { field: 'email', operator: 'ilike', value: 'acme' },
      { field: 'createdAt', operator: 'gte', value: '2024-01-01' },
    ]
    const result = buildGenericWhere(testConfig, filters)
    expect(result).toBeDefined()
  })

  it('handles isNull=true operator', () => {
    const filters = [{ field: 'bannedAt', operator: 'isNull', value: 'true' }]
    const result = buildGenericWhere(testConfig, filters)
    expect(result).toBeDefined()
  })

  it('handles isNull=false operator', () => {
    const filters = [{ field: 'bannedAt', operator: 'isNull', value: 'false' }]
    const result = buildGenericWhere(testConfig, filters)
    expect(result).toBeDefined()
  })

  it('handles between operator with two-element array', () => {
    const filters = [{ field: 'score', operator: 'between', value: ['10', '100'] }]
    const result = buildGenericWhere(testConfig, filters)
    expect(result).toBeDefined()
  })

  it('handles in operator with array value', () => {
    const filters = [{ field: 'role', operator: 'in', value: ['admin', 'user'] }]
    const result = buildGenericWhere(testConfig, filters)
    expect(result).toBeDefined()
  })

  it('throws for an unknown field (schema is expected to catch this upstream)', () => {
    const filters = [{ field: 'unknownField', operator: 'eq', value: 'foo' }]
    expect(() => buildGenericWhere(testConfig, filters)).toThrow(/unknownField/)
  })
})

describe('buildFilterSchema — valueType auto-defaults', () => {
  const booleanConfig: FilterConfig<{ isActive: boolean }> = {
    isActive: { column: mockColumn, operators: ['eq'], valueType: 'boolean' },
  }
  const booleanSchema = buildFilterSchema(booleanConfig)

  it('boolean valueType accepts "true"/"false"', () => {
    expect(booleanSchema.safeParse([{ field: 'isActive', operator: 'eq', value: 'true' }]).success).toBe(true)
    expect(booleanSchema.safeParse([{ field: 'isActive', operator: 'eq', value: 'false' }]).success).toBe(true)
  })

  it('boolean valueType rejects other truthy/falsy strings', () => {
    expect(booleanSchema.safeParse([{ field: 'isActive', operator: 'eq', value: 'yes' }]).success).toBe(false)
    expect(booleanSchema.safeParse([{ field: 'isActive', operator: 'eq', value: '1' }]).success).toBe(false)
    expect(booleanSchema.safeParse([{ field: 'isActive', operator: 'eq', value: '' }]).success).toBe(false)
  })

  const numberConfig: FilterConfig<{ score: number }> = {
    score: { column: mockColumn, operators: ['eq', 'gte'], valueType: 'number' },
  }
  const numberSchema = buildFilterSchema(numberConfig)

  it('number valueType accepts numeric strings (int and decimal, negative allowed)', () => {
    expect(numberSchema.safeParse([{ field: 'score', operator: 'eq', value: '42' }]).success).toBe(true)
    expect(numberSchema.safeParse([{ field: 'score', operator: 'eq', value: '-3.14' }]).success).toBe(true)
    expect(numberSchema.safeParse([{ field: 'score', operator: 'gte', value: '0' }]).success).toBe(true)
  })

  it('number valueType rejects non-numeric strings', () => {
    expect(numberSchema.safeParse([{ field: 'score', operator: 'eq', value: 'abc' }]).success).toBe(false)
    expect(numberSchema.safeParse([{ field: 'score', operator: 'eq', value: 'NaN' }]).success).toBe(false)
    expect(numberSchema.safeParse([{ field: 'score', operator: 'eq', value: '1e5' }]).success).toBe(false)
  })

  const dateConfig: FilterConfig<{ createdAt: Date }> = {
    createdAt: { column: mockColumn, operators: ['gte'], valueType: 'date' },
  }
  const dateSchema = buildFilterSchema(dateConfig)

  it('date valueType accepts ISO 8601 with offset', () => {
    expect(dateSchema.safeParse([{ field: 'createdAt', operator: 'gte', value: '2024-01-01T00:00:00Z' }]).success).toBe(true)
    expect(dateSchema.safeParse([{ field: 'createdAt', operator: 'gte', value: '2024-01-01T12:00:00+02:00' }]).success).toBe(true)
  })

  it('date valueType rejects non-ISO strings', () => {
    expect(dateSchema.safeParse([{ field: 'createdAt', operator: 'gte', value: 'not-a-date' }]).success).toBe(false)
    expect(dateSchema.safeParse([{ field: 'createdAt', operator: 'gte', value: '2024-01-01' }]).success).toBe(false)
  })

  it('explicit valueSchema takes precedence over valueType default', () => {
    const config: FilterConfig<{ status: string }> = {
      status: {
        column: mockColumn,
        operators: ['eq'],
        valueType: 'string',
        valueSchema: z.enum(['open', 'closed']),
      },
    }
    const schema = buildFilterSchema(config)
    expect(schema.safeParse([{ field: 'status', operator: 'eq', value: 'open' }]).success).toBe(true)
    expect(schema.safeParse([{ field: 'status', operator: 'eq', value: 'other' }]).success).toBe(false)
  })
})

describe('buildFilterSchema — valueSchema override', () => {
  const enumConfig: FilterConfig<{ role: string }> = {
    role: { column: mockColumn, operators: ['eq', 'in'], valueSchema: z.enum(['admin', 'moderator', 'user']) },
  }
  const enumSchema = buildFilterSchema(enumConfig)

  it('accepts eq with a value in the enum', () => {
    const result = enumSchema.safeParse([{ field: 'role', operator: 'eq', value: 'admin' }])
    expect(result.success).toBe(true)
  })

  it('rejects eq with a value outside the enum', () => {
    const result = enumSchema.safeParse([{ field: 'role', operator: 'eq', value: 'superuser' }])
    expect(result.success).toBe(false)
  })

  it('applies the value schema per-item for the "in" operator', () => {
    const good = enumSchema.safeParse([{ field: 'role', operator: 'in', value: ['admin', 'moderator'] }])
    expect(good.success).toBe(true)
    const bad = enumSchema.safeParse([{ field: 'role', operator: 'in', value: ['admin', 'superuser'] }])
    expect(bad.success).toBe(false)
  })

  const dateConfig: FilterConfig<{ createdAt: Date }> = {
    createdAt: {
      column: mockColumn,
      operators: ['gte', 'between'],
      valueSchema: z.string().datetime({ offset: true }),
    },
  }
  const dateSchema = buildFilterSchema(dateConfig)

  it('accepts gte with a valid ISO date', () => {
    const result = dateSchema.safeParse([{ field: 'createdAt', operator: 'gte', value: '2024-01-01T00:00:00Z' }])
    expect(result.success).toBe(true)
  })

  it('rejects gte with an invalid date', () => {
    const result = dateSchema.safeParse([{ field: 'createdAt', operator: 'gte', value: 'not-a-date' }])
    expect(result.success).toBe(false)
  })

  it('applies the value schema per-item for the "between" operator', () => {
    const good = dateSchema.safeParse([
      { field: 'createdAt', operator: 'between', value: ['2024-01-01T00:00:00Z', '2024-12-31T00:00:00Z'] },
    ])
    expect(good.success).toBe(true)
    const bad = dateSchema.safeParse([
      { field: 'createdAt', operator: 'between', value: ['2024-01-01T00:00:00Z', 'nope'] },
    ])
    expect(bad.success).toBe(false)
  })

  it('ignores the value schema for isNull (only accepts "true"/"false")', () => {
    const config: FilterConfig<{ deletedAt: Date | null }> = {
      deletedAt: { column: mockColumn, operators: ['isNull'], valueSchema: z.string().datetime() },
    }
    const schema = buildFilterSchema(config)
    expect(schema.safeParse([{ field: 'deletedAt', operator: 'isNull', value: 'true' }]).success).toBe(true)
    expect(schema.safeParse([{ field: 'deletedAt', operator: 'isNull', value: 'false' }]).success).toBe(true)
    expect(schema.safeParse([{ field: 'deletedAt', operator: 'isNull', value: '2024-01-01' }]).success).toBe(false)
  })
})

describe('escapeIlikePattern', () => {
  it('escapes backslash', () => {
    expect(escapeIlikePattern('a\\b')).toBe('a\\\\b')
  })

  it('escapes percent sign', () => {
    expect(escapeIlikePattern('100%')).toBe('100\\%')
  })

  it('escapes underscore', () => {
    expect(escapeIlikePattern('a_b')).toBe('a\\_b')
  })

  it('leaves plain strings untouched', () => {
    expect(escapeIlikePattern('hello world')).toBe('hello world')
  })
})
