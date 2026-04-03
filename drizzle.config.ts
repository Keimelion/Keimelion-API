import type { Config } from 'drizzle-kit'
import { config } from 'dotenv'

config()

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL is required for Drizzle Kit')
}

export default {
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'],
  },
} satisfies Config
