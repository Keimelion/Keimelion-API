import { createFeatureRouter } from '../../../shared/types/app.js'
import { mountListCollaboratorInvites } from './endpoints/list.js'

export const adminCollaboratorInvitesRouter = createFeatureRouter()

mountListCollaboratorInvites(adminCollaboratorInvitesRouter)
