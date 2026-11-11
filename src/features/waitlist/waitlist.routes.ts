import { createFeatureRouter } from '../../shared/types/app.js'
import { mountConfirmWaitlistEntry } from './endpoints/confirm-waitlist-entry.js'
import { mountCreateWaitlistEntry } from './endpoints/create-waitlist-entry.js'
import { mountUnsubscribeWaitlistEntry } from './endpoints/unsubscribe-waitlist-entry.js'

export const waitlistRouter = createFeatureRouter()

mountCreateWaitlistEntry(waitlistRouter)
mountConfirmWaitlistEntry(waitlistRouter)
mountUnsubscribeWaitlistEntry(waitlistRouter)
