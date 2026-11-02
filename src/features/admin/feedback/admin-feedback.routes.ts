import { createFeatureRouter } from '../../../shared/types/app.js'
import { mountListFeedback } from './endpoints/list.js'
import { mountUpdateFeedback } from './endpoints/update.js'

export const adminFeedbackRouter = createFeatureRouter()

mountListFeedback(adminFeedbackRouter)
mountUpdateFeedback(adminFeedbackRouter)
