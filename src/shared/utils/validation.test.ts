import { Hono } from 'hono'
import { describe, it, expect } from 'vitest'
import { z, ZodError } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { validationErrorHandler } from './validation.js'
import { HttpStatus } from '../enums/http.js'
import { ErrorCode } from '../enums/error-code.js'

interface ValidationErrorBody {
  message: string
  code: string
  metadata: { issues: { path: string; message: string; code: string }[] }
}

describe('validationErrorHandler', () => {
  it('returns undefined on success without modifying anything', () => {
    const result = validationErrorHandler(
      { success: true } as never,
      {} as never,
    )
    expect(result).toBeUndefined()
  })

  it('maps a flat ZodError issue to metadata.issues', async () => {
    const schema = z.object({ slug: z.string().regex(/^[a-z]+$/, 'slug must be lowercase') })
    const app = new Hono().post('/', zValidator('json', schema, validationErrorHandler), (c) => c.text('ok'))

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'INVALID' }),
    })

    expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    const body = await response.json() as ValidationErrorBody
    expect(body.code).toBe(ErrorCode.UNPROCESSABLE_ENTITY)
    expect(body.message).toBe('Validation failed')
    expect(body.metadata.issues).toHaveLength(1)
    expect(body.metadata.issues[0]).toEqual({
      path: 'slug',
      message: 'slug must be lowercase',
      code: 'invalid_string',
    })
  })

  it('dot-joins a nested array path (e.g. translations.0.locale)', async () => {
    const schema = z.object({
      translations: z.array(z.object({ locale: z.enum(['en', 'fr']) })),
    })
    const app = new Hono().post('/', zValidator('json', schema, validationErrorHandler), (c) => c.text('ok'))

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ translations: [{ locale: 'xx' }] }),
    })

    expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    const body = await response.json() as ValidationErrorBody
    expect(body.metadata.issues[0]?.path).toBe('translations.0.locale')
  })

  it('maps an empty path (root issue) to "<root>"', async () => {
    const schema = z.object({ a: z.string() }).refine(() => false, 'root-level invariant failed')
    const app = new Hono().post('/', zValidator('json', schema, validationErrorHandler), (c) => c.text('ok'))

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 'ok' }),
    })

    expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    const body = await response.json() as ValidationErrorBody
    const rootIssue = body.metadata.issues.find((issue) => issue.path === '<root>')
    expect(rootIssue).toBeDefined()
    expect(rootIssue?.message).toBe('root-level invariant failed')
  })

  it('includes one entry per ZodError issue', () => {
    const error = new ZodError([
      { code: 'custom', path: ['a'], message: 'A failed' },
      { code: 'custom', path: ['b', 0, 'c'], message: 'C failed' },
    ])
    const context = {
      json: (body: unknown, status: number): { body: unknown; status: number } => ({
        body,
        status,
      }),
    }
    const result = validationErrorHandler(
      { success: false, error },
      context as never,
    ) as unknown as { body: ValidationErrorBody; status: number }

    expect(result.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(result.body.metadata.issues).toEqual([
      { path: 'a', message: 'A failed', code: 'custom' },
      { path: 'b.0.c', message: 'C failed', code: 'custom' },
    ])
  })
})
