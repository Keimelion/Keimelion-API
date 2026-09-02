import { config } from 'dotenv'
import { z } from 'zod'
import { NODE_ENV_VALUES, NodeEnvs } from '../shared/enums/node-env.js'

config()

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(NODE_ENV_VALUES).default(NodeEnvs.DEVELOPMENT),
  CORS_ORIGINS: z.string().default('http://localhost:3001'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  EMAIL_VERIFY_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(24),
  BCRYPT_ROUNDS: z.coerce.number().int().positive().default(12),
  APP_URL: z.string().url().default('http://localhost:3000'),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  JWT_CLEANUP_INTERVAL_MS: z.coerce.number().int().min(60_000).default(3_600_000),
  USER_HARD_DELETE_INTERVAL_MS: z.coerce.number().int().min(60_000).default(3_600_000),
  USER_HARD_DELETE_GRACE_DAYS: z.coerce.number().int().min(1).default(30),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

export const env = parsed.data
