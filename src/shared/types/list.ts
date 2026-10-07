import type { List } from '../../db/entities/lists/lists.schema.js'
import type { ListCollaborator } from '../../db/entities/list-collaborators/list-collaborators.schema.js'
import type { User } from '../../db/entities/users/users.schema.js'
import type { UserDetail } from './user.js'

export interface ListDetail {
  id: string
  title: string
  slug: string
  description: string | null
  listStatus: string
  occasionTypeId: string | null
  eventDate: string | null
  isGalleryPublic: boolean
  owner: UserDetail | null
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ListCollaboratorWithUser extends ListCollaborator {
  user: User | null
}

export interface ListRowWithOwner extends List {
  collaborators: ListCollaboratorWithUser[]
}

export function toListDetail(list: List, owner: UserDetail | null): ListDetail {
  return {
    id: list.id,
    title: list.title,
    slug: list.slug,
    description: list.description ?? null,
    listStatus: list.listStatus,
    occasionTypeId: list.occasionTypeId ?? null,
    eventDate: list.eventDate ?? null,
    isGalleryPublic: list.isGalleryPublic,
    owner,
    archivedAt: list.archivedAt ?? null,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  }
}
