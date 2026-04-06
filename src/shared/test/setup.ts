import { vi } from 'vitest'

vi.mock('../../config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgres://localhost/test',
    PORT: 3000,
    NODE_ENV: 'test' as const,
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
  },
}))

vi.mock('../../db/client.js', () => ({
  db: {
    execute: vi.fn(),
    query: {
      users: {
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
  },
}))

vi.mock('hono-rate-limiter', () => ({
  rateLimiter: () => async (_context: unknown, next: () => Promise<void>) => {
    await next()
  },
}))
