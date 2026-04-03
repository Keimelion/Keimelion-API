import { config } from 'dotenv'
import { z } from 'zod'

config()

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGINS: z.string().default('http://localhost:3001'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
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
