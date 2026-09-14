import { createFeatureRouter } from '../../../shared/types/app.js'
import { mountCreateOccasionType } from './endpoints/create.js'
import { mountListOccasionTypes } from './endpoints/list.js'
import { mountUpdateOccasionType } from './endpoints/update.js'
import { mountDeleteOccasionType } from './endpoints/delete.js'

export const adminOccasionTypesRouter = createFeatureRouter()

mountCreateOccasionType(adminOccasionTypesRouter)
mountListOccasionTypes(adminOccasionTypesRouter)
mountUpdateOccasionType(adminOccasionTypesRouter)
mountDeleteOccasionType(adminOccasionTypesRouter)
