import { createFeatureRouter } from '../../shared/types/app.js'
import { mountUpdateListItem } from './endpoints/update-list-item.js'
import { mountDeleteListItem } from './endpoints/delete-list-item.js'

export const listItemsRouter = createFeatureRouter()

mountUpdateListItem(listItemsRouter)
mountDeleteListItem(listItemsRouter)
