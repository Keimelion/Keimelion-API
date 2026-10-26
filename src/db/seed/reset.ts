import { rm } from 'fs/promises'
import { dirname, join } from 'path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { env } from '../../config/env.js'
import * as schema from '../entities/index.js'
import { SEEDERS } from './seeders.js'
import { getSeedImageFileKey } from './seed-images.js'

const client = postgres(env.DATABASE_URL)
const db = drizzle(client, { schema })

try {
  console.log('Dropping schema...')
  await client`DROP SCHEMA public CASCADE`
  await client`DROP SCHEMA IF EXISTS drizzle CASCADE`
  await client`CREATE SCHEMA public`

  // Wipe disk variants for the seeded fixture so a fresh reset is deterministic:
  // the schema drop removes the images row but leaves webp files on disk,
  // which would make the next pipeline run skip writes (and hide regressions
  // in writeAllVariants). We only touch the fixture's own content-addressed
  // directory, never the full UPLOADS_DIR, so unrelated local uploads survive.
  console.log('Clearing seeded image variants from UPLOADS_DIR...')
  const seedFileKey = await getSeedImageFileKey()
  await rm(join(env.UPLOADS_DIR, dirname(seedFileKey)), { recursive: true, force: true })

  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: 'src/db/migrations' })

  console.log('Seeding...')
  for (const run of SEEDERS) {
    await run(db)
  }

  console.log('Done.')
  await client.end()
  process.exit(0)
} catch (error: unknown) {
  console.error('Reset failed:', error)
  await client.end()
  process.exit(1)
}
