import type { DbTransaction } from '../../db/client.js'
import type { ItemContributionAction } from '@keimelion/sdk/enums'
import { itemContributionChangesSchema } from '@keimelion/sdk/schemas'
import type { ItemContributionChangesParsed } from '@keimelion/sdk/schemas'
import { insertItemContribution } from '../../db/entities/item-contributions/item-contributions.repository.js'
import type { Item } from '../../db/entities/items/items.schema.js'

// Allow-list derived from the SDK contract: only these fields ever reach the jsonb, whatever the patch holds.
const TRACKED_ITEM_FIELDS = itemContributionChangesSchema.keyof().options

type TrackedItemField = (typeof TRACKED_ITEM_FIELDS)[number] & keyof Item

export type TrackedItemFields = Pick<Item, TrackedItemField>

type TrackedItemFieldsPatch = { [Field in TrackedItemField]?: Item[Field] | undefined }

export interface ItemContributionWrite {
  itemId: string
  userId: string
  action: ItemContributionAction
  previous: TrackedItemFields
  patch: TrackedItemFieldsPatch
}

export async function recordItemContribution(write: ItemContributionWrite, tx: DbTransaction): Promise<void> {
  const changes = buildItemChanges(write.previous, write.patch)
  if (Object.keys(changes).length === 0) return
  await insertItemContribution({ itemId: write.itemId, userId: write.userId, action: write.action, changes }, tx)
}

function buildItemChanges(previous: TrackedItemFields, patch: TrackedItemFieldsPatch): ItemContributionChangesParsed {
  return Object.fromEntries(
    TRACKED_ITEM_FIELDS.flatMap((field) => {
      const value = patch[field]
      if (value === undefined || value === previous[field]) return []
      return [[field, { from: previous[field], to: value }]]
    }),
  )
}
