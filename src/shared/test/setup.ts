import { vi } from 'vitest'
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
    REFRESH_TOKEN_EXPIRES_IN: 2592000,
  },
}))

vi.mock('../../db/client.js', () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(() => ({
      from: vi.fn(() => Promise.resolve([])),
    })),
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
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
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
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve([])) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) })),
        delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })),
      }
      return callback(tx)
    }),
  },
}))

vi.mock('hono-rate-limiter', () => ({
  rateLimiter: () => async (_context: unknown, next: () => Promise<void>) => {
    await next()
  },
}))
