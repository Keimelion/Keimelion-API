import { createFeatureRouter } from '../../shared/types/app.js'
import { mountAddItem } from './endpoints/add-item.js'
import { mountCreateList } from './endpoints/create.js'
import { mountListUserLists } from './endpoints/list.js'
import { mountGetUserList } from './endpoints/get.js'
import { mountUpdateUserList } from './endpoints/update.js'
import { mountDeleteUserList } from './endpoints/delete.js'
import { mountCreateInvite } from './endpoints/collaborators/create-invite.js'
import { mountRevokeInvite } from './endpoints/collaborators/revoke-invite.js'
import { mountLeaveList } from './endpoints/collaborators/leave-list.js'
import { mountRemoveCollaborator } from './endpoints/collaborators/remove-collaborator.js'
import { mountAcceptInvite } from './endpoints/collaborators/accept-invite.js'
import { mountDeclineInvite } from './endpoints/collaborators/decline-invite.js'

export const listsRouter = createFeatureRouter()

mountListUserLists(listsRouter)
mountCreateList(listsRouter)
mountGetUserList(listsRouter)
mountUpdateUserList(listsRouter)
mountDeleteUserList(listsRouter)
mountAddItem(listsRouter)
mountCreateInvite(listsRouter)
mountRevokeInvite(listsRouter)
mountLeaveList(listsRouter)
mountRemoveCollaborator(listsRouter)

export const collaboratorsRouter = createFeatureRouter()

mountAcceptInvite(collaboratorsRouter)
mountDeclineInvite(collaboratorsRouter)
