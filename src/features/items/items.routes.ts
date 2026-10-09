import { createFeatureRouter } from '../../shared/types/app.js'
import { mountListItems } from './endpoints/list.js'
import { mountGetItem } from './endpoints/get.js'
import { mountAssignCategories } from './endpoints/assign-categories.js'

export const itemsRouter = createFeatureRouter()

mountListItems(itemsRouter)
mountGetItem(itemsRouter)
mountAssignCategories(itemsRouter)
