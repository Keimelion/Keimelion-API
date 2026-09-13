import { createFeatureRouter } from '../../shared/types/app.js'
import { mountListOccasionTypes } from './endpoints/list.js'

export const occasionTypesRouter = createFeatureRouter()
mountListOccasionTypes(occasionTypesRouter)
