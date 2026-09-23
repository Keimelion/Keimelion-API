import { createFeatureRouter } from '../../../shared/types/app.js'
import { mountCreateItem } from './endpoints/create.js'
import { mountListItems } from './endpoints/list.js'
import { mountGetItem } from './endpoints/get.js'
import { mountUpdateItem } from './endpoints/update.js'
import { mountDeleteItem } from './endpoints/delete.js'
import { mountRestoreItem } from './endpoints/restore.js'
import { mountListItemSources } from './endpoints/list-sources.js'
import { mountCreateItemSource } from './endpoints/create-source.js'
import { mountUpdateItemSource } from './endpoints/update-source.js'
import { mountDeleteItemSource } from './endpoints/delete-source.js'

export const adminItemsRouter = createFeatureRouter()

mountCreateItem(adminItemsRouter)
mountListItems(adminItemsRouter)
mountGetItem(adminItemsRouter)
mountUpdateItem(adminItemsRouter)
mountDeleteItem(adminItemsRouter)
mountRestoreItem(adminItemsRouter)
mountListItemSources(adminItemsRouter)
mountCreateItemSource(adminItemsRouter)
mountUpdateItemSource(adminItemsRouter)
mountDeleteItemSource(adminItemsRouter)
