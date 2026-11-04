import { createFeatureRouter } from '../../../shared/types/app.js'
import { mountListAdminInvites } from './endpoints/list.js'

export const adminListInvitesRouter = createFeatureRouter()

mountListAdminInvites(adminListInvitesRouter)
