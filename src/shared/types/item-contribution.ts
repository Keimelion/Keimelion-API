import type { ItemContributionDetailParsed } from '@keimelion/sdk/schemas'
import type { ItemContribution } from '../../db/entities/item-contributions/item-contributions.schema.js'
import type { User } from '../../db/entities/users/users.schema.js'
import type { ItemRowWithSources } from './item.js'

export type ItemContributionDetail = ItemContributionDetailParsed

export interface ItemContributionRowWithUser extends ItemContribution {
  user: Pick<User, 'id' | 'username'> | null
}

export interface ItemRowWithSourcesAndContributions extends ItemRowWithSources {
  contributions: ItemContributionRowWithUser[]
}
