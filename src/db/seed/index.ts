import { db } from '../client.js'
import { seedUsers } from './users.js'

async function seed(): Promise<void> {
  console.log('Seeding...')
  await seedUsers(db)
  console.log('Done.')
  process.exit(0)
}

try {
  await seed()
} catch (error: unknown) {
  console.error('Seed failed:', error)
  process.exit(1)
}
