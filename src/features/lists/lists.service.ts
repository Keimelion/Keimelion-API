import { db } from '../../db/client.js'
import { HttpStatus } from '../../shared/enums/http.js'
import { ErrorCode } from '../../shared/enums/error-code.js'
import { ItemStatuses } from '../../shared/enums/item-status.js'
import { serviceError } from '../../shared/utils/response.js'
import { insertItem } from '../../db/entities/items/items.repository.js'
import { insertItemSource } from '../../db/entities/item-sources/item-sources.repository.js'
import { insertListItem } from '../../db/entities/list-items/list-items.repository.js'
import { toBaseItem, toBaseListItem, toBaseItemSource } from './lists.mapper.js'
import type { Item } from '../../db/entities/items/items.schema.js'
import type { ItemSource } from '../../db/entities/item-sources/item-sources.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { ListItemResponse } from './lists.mapper.js'
import type { ServiceResult } from '../../shared/types/service.js'
import type { AddItemInput } from './endpoints/add-item.js'

const DEFAULT_MODERATION_STATUS = 'approved'
const DEFAULT_QUANTITY_DESIRED = 1
const DEFAULT_CURRENCY = 'EUR'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

interface CreatedListItemRecord {
  item: Item
  source: ItemSource | null
  listItem: ListItem
}

export async function addItemToList(
  listId: string,
  userId: string,
  input: AddItemInput,
): Promise<ServiceResult<{ listItem: ListItemResponse }>> {
  const record = await db.transaction((tx) => createManualListItem(tx, listId, userId, input))
  if (!record) return serviceError(ErrorCode.INTERNAL_ERROR)

  return { data: { listItem: buildListItemResponse(record) }, httpStatus: HttpStatus.CREATED }
}

async function createManualListItem(
  tx: DbTransaction,
  listId: string,
  userId: string,
  input: AddItemInput,
): Promise<CreatedListItemRecord | null> {
  const item = await insertItem({
    name: input.name,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    createdByUserId: userId,
    moderationStatus: DEFAULT_MODERATION_STATUS,
  }, tx)
  if (!item) return null

  const source = input.price === undefined ? null : (await insertItemSource({
    itemId: item.id,
    sourceUrl: null,
    price: String(input.price),
    currency: DEFAULT_CURRENCY,
    isPrimary: true,
  }, tx)) ?? null

  const listItem = await insertListItem({
    listId,
    itemId: item.id,
    quantityDesired: input.quantityDesired ?? DEFAULT_QUANTITY_DESIRED,
    creatorNote: input.creatorNote ?? null,
    itemStatus: ItemStatuses.AVAILABLE,
  }, tx)
  if (!listItem) return null

  return { item, source, listItem }
}

function buildListItemResponse(record: CreatedListItemRecord): ListItemResponse {
  return {
    ...toBaseListItem(record.listItem),
    item: toBaseItem(record.item),
    source: record.source ? toBaseItemSource(record.source) : null,
  }
}
