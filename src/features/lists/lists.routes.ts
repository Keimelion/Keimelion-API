import { createFeatureRouter } from '../../shared/types/app.js'
import { mountAddItem } from './endpoints/add-item.js'

export const listsRouter = createFeatureRouter()

mountAddItem(listsRouter)
