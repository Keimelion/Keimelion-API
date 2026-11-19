import type { DbTransaction } from '../../db/client.js'
import type { ItemContributionAction } from '@keimelion/sdk/enums'
import type { ItemContributionChangesParsed } from '@keimelion/sdk/schemas'
import { insertItemContribution } from '../../db/entities/item-contributions/item-contributions.repository.js'
import type { Item } from '../../db/entities/items/items.schema.js'

type TrackedItemField = keyof ItemContributionChangesParsed & keyof Item

export type TrackedItemFields = Pick<Item, TrackedItemField>

type TrackedItemFieldsPatch = { [Field in TrackedItemField]?: Item[Field] | undefined }

type TrackedItemFieldChange = [TrackedItemField, string | null]

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
  const entries = Object.entries(patch) as [TrackedItemField, string | null | undefined][]
  return Object.fromEntries(
    entries
      .filter((entry): entry is TrackedItemFieldChange => entry[1] !== undefined && entry[1] !== previous[entry[0]])
      .map(([field, value]) => [field, { from: previous[field], to: value }]),
  )
}
