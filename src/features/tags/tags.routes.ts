import { createFeatureRouter } from '../../shared/types/app.js'
import { mountListTags } from './endpoints/list.js'

export const tagsRouter = createFeatureRouter()

mountListTags(tagsRouter)
