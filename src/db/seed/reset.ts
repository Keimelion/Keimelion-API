import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { env } from '../../config/env.js'
import * as schema from '../schema/index.js'
import { seedUsers } from './users.js'

const client = postgres(env.DATABASE_URL)
const db = drizzle(client, { schema })

try {
  console.log('Dropping schema...')
  await client`DROP SCHEMA public CASCADE`
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
