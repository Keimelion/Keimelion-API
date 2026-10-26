import type { List } from '../../db/entities/lists/lists.schema.js'
import type { ListCollaborator } from '../../db/entities/list-collaborators/list-collaborators.schema.js'
import type { ListTagWithTag } from '../../db/entities/list-tags/list-tags.schema.js'
import type { User } from '../../db/entities/users/users.schema.js'
import type { Image } from '../../db/entities/images/images.schema.js'
import type { ItemStatus } from '../enums/item-status.js'
import type { Locale } from '../enums/locale.js'
import { toUserDetail } from './user.js'
import { toTagPublic } from './tag.js'
import { toItemSourceDetail } from './item.js'
import type { ItemRowWithSources, ItemSourceDetail, ListItemRowWithImage } from './item.js'
import { resolveCategoryName, toCategoryPublic } from './category.js'
import type { CategoryPublic } from './category.js'
import { toImageDetail } from '../../features/uploads/images.mapper.js'
import type { ImageDetail } from '../../features/uploads/images.mapper.js'
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

export interface PublicUserDetail {
  id: string
  username: string | null
  avatarUrl: string | null
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
  image: ImageDetail | null
  item: PublicItemDetail
  createdAt: Date
  updatedAt: Date
}

export interface PublicItemDetail {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
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

export interface PublicCollaboratorRow extends ListCollaborator {
  user: (User & { avatarImage: Image | null }) | null
}

export interface PublicListItemRow extends ListItemRowWithImage {
  item: ItemRowWithSources
}

export interface PublicListRow extends List {
  collaborators: PublicCollaboratorRow[]
  listTags: ListTagWithTag[]
  listItems: PublicListItemRow[]
}

export function toPublicListDetail(row: PublicListRow, locale: Locale): PublicListDetail {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? null,
    listStatus: row.listStatus,
    occasionTypeId: row.occasionTypeId ?? null,
    owner: toPublicOwner(row.collaborators[0]?.user ?? null),
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
    avatarUrl: user.avatarUrl ?? null,
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
    image: row.image ? toImageDetail(row.image) : null,
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
    imageUrl: item.imageUrl ?? null,
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
