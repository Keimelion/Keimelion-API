import type { List } from '../../db/entities/lists/lists.schema.js'
import type { ListUser } from '../../db/entities/list-users/list-users.schema.js'
import type { ListTagWithTag } from '../../db/entities/list-tags/list-tags.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { User } from '../../db/entities/users/users.schema.js'
import type { Image } from '../../db/entities/images/images.schema.js'
import type { ItemStatus } from '../enums/item-status.js'
import type { Locale } from '../enums/locale.js'
import { toUserDetail } from './user.js'
import { toTagPublic } from './tag.js'
import { toItemSourceDetail } from './item.js'
import type { ItemRowWithSources, ItemSourceDetail } from './item.js'
import { resolveCategoryName, toCategoryPublic } from './category.js'
import type { CategoryPublic } from './category.js'
import { toImageDetail } from '../../features/uploads/images.mapper.js'
import type { ImageDetail } from '../../features/uploads/images.mapper.js'
import type { UserDetail } from './user.js'
import type { TagPublic } from './tag.js'
import { toListMemberUser } from './collaborator.js'
import type { CollaboratorSummary, ListMemberUser } from './collaborator.js'
import { CONTRIBUTOR_ROLE_VALUES, ListUserRoles } from '../enums/list-user-role.js'
import type { ListUserRole } from '../enums/list-user-role.js'

export interface ListDetail {
  id: string
  title: string
  slug: string
  description: string | null
  listStatus: string
  occasionTypeId: string | null
  owner: ListMemberUser | null
  collaborators?: CollaboratorSummary[]
  tags: TagPublic[]
  createdAt: Date
  updatedAt: Date
}

export interface ListUserWithUser extends ListUser {
  user: User | null
}

export interface ListRowWithOwner extends List {
  listUsers: ListUserWithUser[]
  listTags: ListTagWithTag[]
}

interface ListMembership<TUser> {
  userId: string
  role: ListUserRole
  user: TUser
}

export function findOwnerUser<TUser>(listUsers: readonly ListMembership<TUser | null>[]): TUser | null {
  return listUsers.find((member) => member.role === ListUserRoles.OWNER)?.user ?? null
}

export function isListOwner(listUsers: readonly ListMembership<unknown>[], userId: string): boolean {
  return listUsers.some((member) => member.userId === userId && member.role === ListUserRoles.OWNER)
}

export function isListContributor(listUsers: readonly ListMembership<unknown>[], userId: string): boolean {
  const contributorRoles: readonly ListUserRole[] = CONTRIBUTOR_ROLE_VALUES
  return listUsers.some((member) => member.userId === userId && contributorRoles.includes(member.role))
}

export function extractOwnerDetail(row: ListRowWithOwner): UserDetail | null {
  const ownerUser = findOwnerUser(row.listUsers)
  return ownerUser ? toUserDetail(ownerUser) : null
}

export function toListDetail(row: ListRowWithOwner, collaborators?: CollaboratorSummary[]): ListDetail {
  const ownerUser = findOwnerUser(row.listUsers)
  const base: ListDetail = {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? null,
    listStatus: row.listStatus,
    occasionTypeId: row.occasionTypeId ?? null,
    owner: ownerUser ? toListMemberUser(ownerUser) : null,
    tags: row.listTags.map((link) => toTagPublic(link.tag)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
  if (collaborators !== undefined) base.collaborators = collaborators
  return base
}

export interface PublicUserDetail {
  id: string
  username: string | null
  avatar: ImageDetail | null
}

export interface PublicListItemDetail {
  id: string
  listId: string
  itemId: string
  quantityDesired: number
  quantityReservedTotal: number
  itemStatus: ItemStatus
  sortOrder: number | null
  creatorNote: string | null
  item: PublicItemDetail
  createdAt: Date
  updatedAt: Date
}

export interface PublicItemDetail {
  id: string
  name: string
  description: string | null
  imageId: string | null
  image: ImageDetail | null
  sources: ItemSourceDetail[]
  categories: CategoryPublic[]
  tags: TagPublic[]
  createdAt: Date
  updatedAt: Date
}

export interface PublicListDetail {
  id: string
  title: string
  slug: string
  description: string | null
  listStatus: string
  occasionTypeId: string | null
  owner: PublicUserDetail | null
  tags: TagPublic[]
  items: PublicListItemDetail[]
  createdAt: Date
  updatedAt: Date
}

export interface PublicListUserRow extends ListUser {
  user: (User & { avatarImage: Image | null }) | null
}

export interface PublicListItemRow extends ListItem {
  item: ItemRowWithSources
}

export interface PublicListRow extends List {
  listUsers: PublicListUserRow[]
  listTags: ListTagWithTag[]
  listItems: PublicListItemRow[]
}

export function toPublicListDetail(row: PublicListRow, locale: Locale): PublicListDetail {
  const ownerUser = findOwnerUser(row.listUsers)
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? null,
    listStatus: row.listStatus,
    occasionTypeId: row.occasionTypeId ?? null,
    owner: toPublicOwner(ownerUser),
    tags: row.listTags.map((link) => toTagPublic(link.tag)),
    items: row.listItems.map((listItem) => toPublicListItem(listItem, locale)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toPublicOwner(user: (User & { avatarImage: Image | null }) | null): PublicUserDetail | null {
  if (!user) return null
  return {
    id: user.id,
    username: user.username ?? null,
    avatar: user.avatarImage ? toImageDetail(user.avatarImage) : null,
  }
}

function toPublicListItem(row: PublicListItemRow, locale: Locale): PublicListItemDetail {
  return {
    id: row.id,
    listId: row.listId,
    itemId: row.itemId,
    quantityDesired: row.quantityDesired,
    quantityReservedTotal: row.quantityReservedTotal,
    itemStatus: row.itemStatus,
    sortOrder: row.sortOrder ?? null,
    creatorNote: row.creatorNote ?? null,
    item: toPublicItemDetail(row.item, locale),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toPublicItemDetail(item: ItemRowWithSources, locale: Locale): PublicItemDetail {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    imageId: item.imageId ?? null,
    image: item.image ? toImageDetail(item.image) : null,
    sources: item.sources.map((source) => toItemSourceDetail(source)),
    categories: item.itemCategories.map((link) =>
      toCategoryPublic({
        id: link.category.id,
        parentId: link.category.parentId,
        slug: link.category.slug,
        depth: link.category.depth,
        name: resolveCategoryName(link.category.translations, locale),
      }),
    ),
    tags: item.itemTags.map((link) => toTagPublic(link.tag)),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}
