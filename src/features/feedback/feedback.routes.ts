import { createFeatureRouter } from '../../shared/types/app.js'
import { mountCreateFeedback } from './endpoints/create.js'

export const feedbackRouter = createFeatureRouter()

mountCreateFeedback(feedbackRouter)
