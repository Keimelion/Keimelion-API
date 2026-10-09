import { createFeatureRouter } from '../../shared/types/app.js'
import { mountListCategories } from './endpoints/list.js'

export const categoriesRouter = createFeatureRouter()

mountListCategories(categoriesRouter)
