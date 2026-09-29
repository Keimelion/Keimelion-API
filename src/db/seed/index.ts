import { db } from '../client.js'
import { SEEDERS } from './seeders.js'
import { assertItemsHaveSources, cleanupSourcelessItems } from './invariants.js'

async function seed(): Promise<void> {
  console.log('Seeding...')
  await cleanupSourcelessItems(db)
  for (const run of SEEDERS) {
    await run(db)
  }
  await assertItemsHaveSources(db)
  console.log('Done.')
  process.exit(0)
}

try {
  await seed()
} catch (error: unknown) {
  console.error('Seed failed:', error)
  process.exit(1)
}
