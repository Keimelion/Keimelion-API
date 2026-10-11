import { createFeatureRouter } from '../../shared/types/app.js'
import { mountAddItem } from './endpoints/add-item.js'
import { mountCreateList } from './endpoints/create.js'
import { mountListUserLists } from './endpoints/list.js'
import { mountGetUserList } from './endpoints/get.js'
import { mountUpdateUserList } from './endpoints/update.js'
import { mountDeleteUserList } from './endpoints/delete.js'
import { mountAssignTags } from './endpoints/assign-tags.js'
import { mountRemoveTag } from './endpoints/remove-tags.js'

export const listsRouter = createFeatureRouter()

mountListUserLists(listsRouter)
mountCreateList(listsRouter)
mountGetUserList(listsRouter)
mountUpdateUserList(listsRouter)
mountDeleteUserList(listsRouter)
mountAddItem(listsRouter)
mountAssignTags(listsRouter)
mountRemoveTag(listsRouter)
