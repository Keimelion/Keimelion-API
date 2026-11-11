import { and, eq, inArray, lt, notExists, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '../../client.js'
import { images } from './images.schema.js'
import { items } from '../items/items.schema.js'
import { users } from '../users/users.schema.js'
import { reports } from '../reports/reports.schema.js'
import { ReportStatuses } from '@keimelion/sdk/enums'
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

// Images kept as evidence by a pending report survive: the orphan cleanup job purges them once
// the report is upheld or dismissed.
export async function deleteImageById(id: string, tx?: DbTransaction): Promise<void> {
  const client = tx ?? db
  await client.delete(images).where(and(eq(images.id, id), isNotEvidenceOfPendingReport()))
}

// Serializes writers and the orphan-file sweeper on a given content hash: files are deduplicated
// by hash, so an upload reusing existing files must not race with their deletion.
export async function lockImageHash(hash: string, tx: DbTransaction): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${hash}, 0))`)
}

export async function findExistingImageHashes(hashes: string[], tx?: DbTransaction): Promise<Set<string>> {
  if (hashes.length === 0) return new Set()
  const client = tx ?? db
  const rows = await client.selectDistinct({ hash: images.hash }).from(images).where(inArray(images.hash, hashes))
  return new Set(rows.map((row) => row.hash))
}

// Every FK pointing at images.id must be listed here, or its images will be purged.
export async function deleteUnreferencedImages(createdBefore: Date): Promise<number> {
  const deleted = await db
    .delete(images)
    .where(
      and(
        lt(images.createdAt, createdBefore),
        notExists(db.select({ id: items.id }).from(items).where(eq(items.imageId, images.id))),
        notExists(db.select({ id: users.id }).from(users).where(eq(users.avatarImageId, images.id))),
        isNotEvidenceOfPendingReport(),
      ),
    )
    .returning({ id: images.id })
  return deleted.length
}

function isNotEvidenceOfPendingReport(): SQL {
  return notExists(
    db
      .select({ id: reports.id })
      .from(reports)
      .where(and(eq(reports.targetImageId, images.id), eq(reports.reportStatus, ReportStatuses.PENDING))),
  )
}
