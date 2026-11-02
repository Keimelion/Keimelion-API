import { createFeatureRouter } from '../../../shared/types/app.js'
import { mountListLists } from './endpoints/list.js'
import { mountGetList } from './endpoints/get.js'
import { mountListListItems } from './endpoints/list-items.js'
import { mountUpdateList } from './endpoints/update.js'
import { mountDeleteList } from './endpoints/delete.js'
import { mountRestoreList } from './endpoints/restore.js'

export const adminListsRouter = createFeatureRouter()

mountListLists(adminListsRouter)
mountGetList(adminListsRouter)
mountListListItems(adminListsRouter)
mountUpdateList(adminListsRouter)
mountDeleteList(adminListsRouter)
mountRestoreList(adminListsRouter)
