import type { List } from '../../db/entities/lists/lists.schema.js'
import type { UserDetail } from './user.js'

export interface ListDetail {
  id: string
  title: string
  description: string | null
  listStatus: string
  occasionTypeId: string | null
  owner: UserDetail | null
  createdAt: Date
  updatedAt: Date
}

export function toListDetail(list: List, owner: UserDetail | null): ListDetail {
  return {
    id: list.id,
    title: list.title,
    description: list.description ?? null,
    listStatus: list.listStatus,
    occasionTypeId: list.occasionTypeId ?? null,
    owner,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  }
}
