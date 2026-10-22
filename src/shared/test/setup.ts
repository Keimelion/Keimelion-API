import { beforeEach, vi } from 'vitest'
import { NodeEnvs } from '../enums/node-env.js'

vi.mock('../../config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgres://localhost/test',
    PORT: 3000,
    NODE_ENV: NodeEnvs.TEST,
    CORS_ORIGINS: 'http://localhost:3001',
    RATE_LIMIT_MAX: 1000,
    RATE_LIMIT_WINDOW_MS: 900000,
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
    JWT_EXPIRES_IN: '7d',
    EMAIL_VERIFY_TOKEN_TTL_HOURS: 24,
    BCRYPT_ROUNDS: 4,
    APP_URL: 'http://localhost:3000',
    EMAIL_API_KEY: undefined,
    EMAIL_FROM: undefined,
    JWT_CLEANUP_INTERVAL_MS: 3_600_000,
    REFRESH_TOKEN_CLEANUP_INTERVAL_MS: 3_600_000,
    USER_HARD_DELETE_INTERVAL_MS: 3_600_000,
    USER_HARD_DELETE_GRACE_DAYS: 30,
    REFRESH_TOKEN_EXPIRES_IN: 2592000,
    FX_REFRESH_ENABLED: false,
    FX_REFRESH_INTERVAL_MS: 86_400_000,
    FX_PROVIDER_URL: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
    FEEDBACK_RATE_LIMIT_PER_MINUTE: 5,
    FEEDBACK_RATE_LIMIT_PER_HOUR: 20,
  },
}))

const buildSelectChain = (resolvedValue: unknown[] = []) => {
  const chain = {
    orderBy: vi.fn(() => Promise.resolve(resolvedValue)),
    where: vi.fn(),
    leftJoin: vi.fn(),
    from: vi.fn(),
  }
  chain.where.mockReturnValue(chain)
  chain.leftJoin.mockReturnValue(chain)
  chain.from.mockReturnValue(chain)
  return chain
}

vi.mock('../../db/client.js', () => {
  const db: Record<string, unknown> = {
    execute: vi.fn(),
    select: vi.fn(() => buildSelectChain()),
    query: {
      users: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      accessTokens: {
        findFirst: vi.fn(),
      },
      refreshTokens: {
        findFirst: vi.fn(),
      },
      occasionTypes: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      occasionTypeTranslations: {
        findMany: vi.fn(),
      },
      lists: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      listCollaborators: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      items: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      itemSources: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      listItems: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      shops: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      categories: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      itemCategories: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      tags: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      itemTags: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      listTags: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      feedback: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
  }
  db.transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db))
  return { db }
})

vi.mock('hono-rate-limiter', () => ({
  rateLimiter: () => async (_context: unknown, next: () => Promise<void>) => {
    await next()
  },
}))

beforeEach(async () => {
  const { db } = await import('../../db/client.js')
  const passThrough = (async (callback: (tx: unknown) => Promise<unknown>) => callback(db)) as never
  vi.mocked(db).transaction.mockImplementation(passThrough)
})
