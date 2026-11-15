import { createFeatureRouter } from '../../shared/types/app.js'
import { mountListItems } from './endpoints/list.js'
import { mountGetItem } from './endpoints/get.js'
import { mountCreateItem } from './endpoints/create.js'

export const itemsRouter = createFeatureRouter()

mountListItems(itemsRouter)
mountCreateItem(itemsRouter)
mountGetItem(itemsRouter)
