import type { List } from '../../db/entities/lists/lists.schema.js'
import type { ListCollaborator } from '../../db/entities/list-collaborators/list-collaborators.schema.js'
import type { User } from '../../db/entities/users/users.schema.js'
import { toUserDetail } from './user.js'
import type { UserDetail } from './user.js'

export interface ListDetail {
  id: string
  title: string
  slug: string
  description: string | null
  listStatus: string
  occasionTypeId: string | null
  owner: UserDetail | null
  createdAt: Date
  updatedAt: Date
}

export interface ListCollaboratorWithUser extends ListCollaborator {
  user: User | null
}

export interface ListRowWithOwner extends List {
  collaborators: ListCollaboratorWithUser[]
}

export function extractOwnerDetail(row: ListRowWithOwner): UserDetail | null {
  const ownerUser = row.collaborators[0]?.user ?? null
  return ownerUser ? toUserDetail(ownerUser) : null
}

export function toListDetail(list: List, owner: UserDetail | null): ListDetail {
  return {
    id: list.id,
    title: list.title,
    slug: list.slug,
    description: list.description ?? null,
    listStatus: list.listStatus,
    occasionTypeId: list.occasionTypeId ?? null,
    owner,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  }
}
