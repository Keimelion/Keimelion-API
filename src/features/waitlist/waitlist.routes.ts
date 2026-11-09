import { createFeatureRouter } from '../../shared/types/app.js'
import { mountCreateWaitlistEntry } from './endpoints/create-waitlist-entry.js'

export const waitlistRouter = createFeatureRouter()

mountCreateWaitlistEntry(waitlistRouter)
