import { createFeatureRouter } from '../../shared/types/app.js'
import { mountCreateListItem } from './endpoints/create.js'
import { mountUpdateListItem } from './endpoints/update-list-item.js'
import { mountDeleteListItem } from './endpoints/delete-list-item.js'

export const listItemsRouter = createFeatureRouter()

mountCreateListItem(listItemsRouter)
mountUpdateListItem(listItemsRouter)
mountDeleteListItem(listItemsRouter)
