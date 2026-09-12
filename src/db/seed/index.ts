import { db } from '../client.js'
import { SEEDERS } from './seeders.js'

async function seed(): Promise<void> {
  console.log('Seeding...')
  for (const run of SEEDERS) {
    await run(db)
  }
  console.log('Done.')
  process.exit(0)
}

try {
  await seed()
} catch (error: unknown) {
  console.error('Seed failed:', error)
  process.exit(1)
}
