import { env } from '../../config/env.js'
import type { Image } from '../../db/entities/images/images.schema.js'

export const IMAGE_VARIANT_WIDTHS = {
  sm: 300,
  md: 800,
  lg: 1600,
} as const

export type ImageVariant = keyof typeof IMAGE_VARIANT_WIDTHS

export interface ImageUrls {
  sm: string
  md: string
  lg: string
}

export interface ImageDetail {
  id: string
  hash: string
  mime: string
  sizeBytes: number
  width: number
  height: number
  createdAt: Date
  urls: ImageUrls
}

export function buildImageUrls(fileKey: string): ImageUrls {
  const base = env.UPLOADS_PUBLIC_BASE_URL.replace(/\/+$/, '')
  return {
    sm: `${base}/${fileKey}-${String(IMAGE_VARIANT_WIDTHS.sm)}.webp`,
    md: `${base}/${fileKey}-${String(IMAGE_VARIANT_WIDTHS.md)}.webp`,
    lg: `${base}/${fileKey}-${String(IMAGE_VARIANT_WIDTHS.lg)}.webp`,
  }
}

export function toImageDetail(image: Image): ImageDetail {
  return {
    id: image.id,
    hash: image.hash,
    mime: image.mime,
    sizeBytes: image.sizeBytes,
    width: image.width,
    height: image.height,
    createdAt: image.createdAt,
    urls: buildImageUrls(image.fileKey),
  }
}
