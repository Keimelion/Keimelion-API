import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { env } from '../../config/env.js'
import * as usersSchema from '../entities/users/users.schema.js'
import * as accessTokensSchema from '../entities/access-tokens/access-tokens.schema.js'
import * as userDeletionAuditSchema from '../entities/user-deletion-audit/user-deletion-audit.schema.js'
import * as refreshTokensSchema from '../entities/refresh-tokens/refresh-tokens.schema.js'
import { seedUsers } from '../entities/users/users.fixture.js'

const client = postgres(env.DATABASE_URL)
const db = drizzle(client, { schema: { ...usersSchema, ...accessTokensSchema, ...userDeletionAuditSchema, ...refreshTokensSchema } })

try {
  console.log('Dropping schema...')
  await client`DROP SCHEMA public CASCADE`
  await client`DROP SCHEMA IF EXISTS drizzle CASCADE`
  await client`CREATE SCHEMA public`

  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: 'src/db/migrations' })

  console.log('Seeding...')
  await seedUsers(db)

  console.log('Done.')
  await client.end()
  process.exit(0)
} catch (error: unknown) {
  console.error('Reset failed:', error)
  await client.end()
  process.exit(1)
}
