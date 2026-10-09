import { createFeatureRouter } from '../../../shared/types/app.js'
import { mountCreateTag } from './endpoints/create.js'
import { mountListTags } from './endpoints/list.js'
import { mountGetTag } from './endpoints/get.js'
import { mountUpdateTag } from './endpoints/update.js'
import { mountDeleteTag } from './endpoints/delete.js'

export const adminTagsRouter = createFeatureRouter()

mountCreateTag(adminTagsRouter)
mountListTags(adminTagsRouter)
mountGetTag(adminTagsRouter)
mountUpdateTag(adminTagsRouter)
mountDeleteTag(adminTagsRouter)
