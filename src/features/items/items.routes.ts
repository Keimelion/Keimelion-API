import { createFeatureRouter } from '../../shared/types/app.js'
import { mountListItems } from './endpoints/list.js'
import { mountGetItem } from './endpoints/get.js'

export const itemsRouter = createFeatureRouter()

mountListItems(itemsRouter)
mountGetItem(itemsRouter)
