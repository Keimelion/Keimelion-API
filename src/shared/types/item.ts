import type { Item } from '../../db/entities/items/items.schema.js'
import type { ItemSource } from '../../db/entities/item-sources/item-sources.schema.js'
import type { ItemCategory } from '../../db/entities/item-categories/item-categories.schema.js'
import type { ItemTag } from '../../db/entities/item-tags/item-tags.schema.js'
import type { ListItem } from '../../db/entities/list-items/list-items.schema.js'
import type { Image } from '../../db/entities/images/images.schema.js'
import type { Shop } from '../../db/entities/shops/shops.schema.js'
import type {
  Category,
  CategoryTranslation,
} from '../../db/entities/categories/categories.schema.js'
import type { Tag } from '../../db/entities/tags/tags.schema.js'
import type { ShopPublic } from './shop.js'
import type { CategoryPublic } from './category.js'
import type { TagPublic } from './tag.js'
import type { Locale } from '../enums/locale.js'
import { toShopPublic } from './shop.js'
import { resolveCategoryName, toCategoryPublic } from './category.js'
import { toTagPublic } from './tag.js'
import { toImageDetail } from '../../features/uploads/images.mapper.js'
import type { ImageDetail } from '../../features/uploads/images.mapper.js'

export interface ItemDetail {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ItemWithSources extends ItemDetail {
  sources: ItemSourceDetail[]
  categories: CategoryPublic[]
  tags: TagPublic[]
}

export interface ItemWrite {
  name: string
  description: string | null
  imageUrl: string | null
}

export interface ItemSourceDetail {
  id: string
  itemId: string
  shopId: string | null
  shop: ShopPublic | null
  sourceUrl: string | null
  price: string | null
  currency: string
  createdAt: Date
  updatedAt: Date
}

export interface ItemSourceWithShop extends ItemSource {
  shop: Shop | null
}

export interface CategoryRowWithTranslationsForItem extends Category {
  translations: CategoryTranslation[]
}

export interface ItemCategoryWithCategoryRow extends ItemCategory {
  category: CategoryRowWithTranslationsForItem
}

export interface ItemTagWithTagRow extends ItemTag {
  tag: Tag
}

export interface ItemRowWithSources extends Item {
  sources: ItemSourceWithShop[]
  itemCategories: ItemCategoryWithCategoryRow[]
  itemTags: ItemTagWithTagRow[]
}

export interface ListItemDetail {
  id: string
  listId: string
  itemId: string
  quantityDesired: number
  quantityReservedTotal: number
  itemStatus: string
  sortOrder: number | null
  creatorNote: string | null
  imageId: string | null
  image: ImageDetail | null
  createdAt: Date
  updatedAt: Date
}

export interface ListItemWrite {
  quantityDesired: number
  creatorNote: string | null
  sortOrder: number | null
}

export interface ListItemRowWithImage extends ListItem {
  image: Image | null
}

export function toItemDetail(item: Item): ItemDetail {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    imageUrl: item.imageUrl ?? null,
    createdByUserId: item.createdByUserId ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

export function toItemSourceDetail(source: ItemSourceWithShop): ItemSourceDetail {
  return {
    id: source.id,
    itemId: source.itemId,
    shopId: source.shopId ?? null,
    shop: source.shop ? toShopPublic(source.shop) : null,
    sourceUrl: source.sourceUrl ?? null,
    price: source.price ?? null,
    currency: source.currency,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  }
}

export function toItemSourceDetailWithoutShop(source: ItemSource): ItemSourceDetail {
  return toItemSourceDetail({ ...source, shop: null })
}

export function toItemWithSources(item: ItemRowWithSources, locale: Locale): ItemWithSources {
  return {
    ...toItemDetail(item),
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
  }
}

export function toListItemDetail(listItem: ListItem | ListItemRowWithImage): ListItemDetail {
  const image = 'image' in listItem ? listItem.image : null
  return {
    id: listItem.id,
    listId: listItem.listId,
    itemId: listItem.itemId,
    quantityDesired: listItem.quantityDesired,
    quantityReservedTotal: listItem.quantityReservedTotal,
    itemStatus: listItem.itemStatus,
    sortOrder: listItem.sortOrder ?? null,
    creatorNote: listItem.creatorNote ?? null,
    imageId: listItem.imageId ?? null,
    image: image ? toImageDetail(image) : null,
    createdAt: listItem.createdAt,
    updatedAt: listItem.updatedAt,
  }
}
