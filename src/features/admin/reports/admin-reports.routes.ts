import { createFeatureRouter } from '../../../shared/types/app.js'
import { mountListReports } from './endpoints/list.js'
import { mountGetReport } from './endpoints/get.js'
import { mountUpdateReport } from './endpoints/update.js'

export const adminReportsRouter = createFeatureRouter()

mountListReports(adminReportsRouter)
mountGetReport(adminReportsRouter)
mountUpdateReport(adminReportsRouter)
