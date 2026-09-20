import { createFeatureRouter } from '../../../shared/types/app.js'
import { mountCreateShop } from './endpoints/create.js'
import { mountListShops } from './endpoints/list.js'
import { mountUpdateShop } from './endpoints/update.js'
import { mountDeleteShop } from './endpoints/delete.js'

export const adminShopsRouter = createFeatureRouter()

mountCreateShop(adminShopsRouter)
mountListShops(adminShopsRouter)
mountUpdateShop(adminShopsRouter)
mountDeleteShop(adminShopsRouter)
