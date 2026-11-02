import { and, eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { images } from './images.schema.js'
import type { Image } from './images.schema.js'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

interface InsertImageInput {
  hash: string
  fileKey: string
  mime: string
  sizeBytes: number
  width: number
  height: number
  uploadedBy: string
}

export async function insertImage(input: InsertImageInput, tx?: DbTransaction): Promise<Image | undefined> {
  const client = tx ?? db
  const [image] = await client.insert(images).values(input).returning()
  return image
}

export function findImageById(id: string): Promise<Image | undefined> {
  return db.query.images.findFirst({ where: eq(images.id, id) })
}

export function findImageByIdForUser(id: string, uploadedBy: string): Promise<Image | undefined> {
  return db.query.images.findFirst({ where: and(eq(images.id, id), eq(images.uploadedBy, uploadedBy)) })
}

export function findImagesByUploader(uploadedBy: string): Promise<Image[]> {
  return db.query.images.findMany({ where: eq(images.uploadedBy, uploadedBy) })
}

export async function deleteImageById(id: string, tx?: DbTransaction): Promise<void> {
  const client = tx ?? db
  await client.delete(images).where(eq(images.id, id))
}
