import { createFeatureRouter } from '../../shared/types/app.js'
import { mountCreateReport } from './endpoints/create.js'

export const reportsRouter = createFeatureRouter()

mountCreateReport(reportsRouter)
