import { createFeatureRouter } from '../../../shared/types/app.js'
import { mountCreateCategory } from './endpoints/create.js'
import { mountListCategories } from './endpoints/list.js'
import { mountGetCategory } from './endpoints/get.js'
import { mountUpdateCategory } from './endpoints/update.js'
import { mountDeleteCategory } from './endpoints/delete.js'

export const adminCategoriesRouter = createFeatureRouter()

mountCreateCategory(adminCategoriesRouter)
mountListCategories(adminCategoriesRouter)
mountGetCategory(adminCategoriesRouter)
mountUpdateCategory(adminCategoriesRouter)
mountDeleteCategory(adminCategoriesRouter)
