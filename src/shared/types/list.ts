import type { List } from '../../db/entities/lists/lists.schema.js'
import type { ListCollaborator } from '../../db/entities/list-collaborators/list-collaborators.schema.js'
import type { ListTagWithTag } from '../../db/entities/list-tags/list-tags.repository.js'
import type { User } from '../../db/entities/users/users.schema.js'
import { toUserDetail } from './user.js'
import { toTagPublic } from './tag.js'
import type { UserDetail } from './user.js'
import type { TagPublic } from './tag.js'

export interface ListDetail {
  id: string
  title: string
  slug: string
  description: string | null
  listStatus: string
  occasionTypeId: string | null
  owner: UserDetail | null
  tags: TagPublic[]
  createdAt: Date
  updatedAt: Date
}

export interface ListCollaboratorWithUser extends ListCollaborator {
  user: User | null
}

export interface ListRowWithOwner extends List {
  collaborators: ListCollaboratorWithUser[]
  listTags: ListTagWithTag[]
}

export function extractOwnerDetail(row: ListRowWithOwner): UserDetail | null {
  const ownerUser = row.collaborators[0]?.user ?? null
  return ownerUser ? toUserDetail(ownerUser) : null
}

export function toListDetail(row: ListRowWithOwner, owner: UserDetail | null): ListDetail {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? null,
    listStatus: row.listStatus,
    occasionTypeId: row.occasionTypeId ?? null,
    owner,
    tags: row.listTags.map((link) => toTagPublic(link.tag)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
