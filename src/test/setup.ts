import { vi } from 'vitest'

vi.mock('../config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgres://localhost/test',
    PORT: 3000,
    NODE_ENV: 'test' as const,
    CORS_ORIGINS: 'http://localhost:3001',
    RATE_LIMIT_MAX: 1000,
    RATE_LIMIT_WINDOW_MS: 900000,
  },
}))

vi.mock('../db/client.js', () => ({
  db: {
    execute: vi.fn(),
  },
}))
