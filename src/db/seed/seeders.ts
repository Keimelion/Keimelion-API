import type { db as Db } from '../client.js'
import { seedOccasionTypes } from '../entities/occasion-types/occasion-types.fixture.js'
import { seedUsers } from '../entities/users/users.fixture.js'
import { seedCategories } from '../entities/categories/categories.fixture.js'
import { seedShops } from '../entities/shops/shops.fixture.js'
import { seedTags } from '../entities/tags/tags.fixture.js'
import { seedLists } from '../entities/lists/lists.fixture.js'
import { seedListCollaborators } from '../entities/list-collaborators/list-collaborators.fixture.js'
import { seedListTags } from '../entities/list-tags/list-tags.fixture.js'
import { seedItems } from '../entities/items/items.fixture.js'
import { seedItemSources } from '../entities/item-sources/item-sources.fixture.js'
import { seedListItems } from '../entities/list-items/list-items.fixture.js'
import { seedItemTags } from '../entities/item-tags/item-tags.fixture.js'
import { seedItemCategories } from '../entities/item-categories/item-categories.fixture.js'
import { seedFeedback } from '../entities/feedback/feedback.fixture.js'

export type Seeder = (db: typeof Db) => Promise<void>

export const SEEDERS: readonly Seeder[] = [
  seedOccasionTypes,
  seedUsers,
  seedCategories,
  seedShops,
  seedTags,
  seedLists,
  seedListCollaborators,
  seedListTags,
  seedItems,
  seedItemSources,
  seedListItems,
  seedItemTags,
  seedItemCategories,
  seedFeedback,
]
