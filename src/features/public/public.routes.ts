import { createFeatureRouter } from '../../shared/types/app.js'
import { mountGetPublicListBySlug } from './endpoints/get-list-by-slug.js'

export const publicRouter = createFeatureRouter()

mountGetPublicListBySlug(publicRouter)
