import type { db as Db } from '../client.js'
import { seedOccasionTypes } from '../entities/occasion-types/occasion-types.fixture.js'
import { seedUsers } from '../entities/users/users.fixture.js'

export type Seeder = (db: typeof Db) => Promise<void>

export const SEEDERS: readonly Seeder[] = [
  seedOccasionTypes,
  seedUsers,
]
