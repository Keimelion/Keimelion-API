import { createFeatureRouter } from '../../shared/types/app.js'
import { mountAddItem } from './endpoints/add-item.js'
import { mountAddItemFromUrl } from './endpoints/add-item-from-url.js'

export const listsRouter = createFeatureRouter()

mountAddItem(listsRouter)
mountAddItemFromUrl(listsRouter)
