import type { DbTransaction } from '../../client.js'
import { itemContributions } from './item-contributions.schema.js'
import type { NewItemContribution } from './item-contributions.schema.js'

type InsertItemContributionInput = Pick<NewItemContribution, 'itemId' | 'userId' | 'action' | 'changes'>

export async function insertItemContribution(input: InsertItemContributionInput, tx: DbTransaction): Promise<void> {
  await tx.insert(itemContributions).values(input)
}
