import { createFeatureRouter } from '../../../shared/types/app.js'
import { mountListLists } from './endpoints/list.js'
import { mountGetList } from './endpoints/get.js'
import { mountUpdateList } from './endpoints/update.js'
import { mountDeleteList } from './endpoints/delete.js'
import { mountRestoreList } from './endpoints/restore.js'
import { mountAssignListTags } from './endpoints/assign-tags.js'
import { mountRemoveListTag } from './endpoints/remove-tags.js'

export const adminListsRouter = createFeatureRouter()

mountListLists(adminListsRouter)
mountGetList(adminListsRouter)
mountUpdateList(adminListsRouter)
mountDeleteList(adminListsRouter)
mountRestoreList(adminListsRouter)
mountAssignListTags(adminListsRouter)
mountRemoveListTag(adminListsRouter)
