import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import { eq } from 'drizzle-orm'
import type { db as Db } from '../client.js'
import { processImage } from '../../features/uploads/image.pipeline.js'
import { users } from '../entities/users/users.schema.js'
import { listItems } from '../entities/list-items/list-items.schema.js'
import { images } from '../entities/images/images.schema.js'

/**
 * Fixture image bundled with the repo and run through the real {@link processImage}
 * pipeline at seed time, so the dev DB has at least one real avatar + one real
 * list_item image after `npm run db:seed` — otherwise the Backoffice thumbnails
 * and avatars all fall back to the placeholder.
 */
export const SEED_IMAGE_FIXTURE_PATH = 'src/db/seed/fixtures/sample-avatar.jpg'

/** Email of the seed user that receives the fixture avatar. */
const SEED_AVATAR_USER_EMAIL = 'user@example.com'

/** Deterministic id of the seed list_item that receives the fixture image. */
const SEED_LIST_ITEM_ID = '7d3f0b40-0005-4b60-8000-000000000001'

/**
 * Hex SHA-256 of the fixture file, computed from disk. Used by {@link getSeedImageFileKey}
 * so `reset.ts` can locate the generated variant files on disk without having
 * to replay the pipeline.
 */
export async function getSeedImageHash(): Promise<string> {
  const buffer = await readFile(SEED_IMAGE_FIXTURE_PATH)
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Returns the content-addressed file key (same `aa/bb/<hash>` layout as the
 * production pipeline) for the bundled fixture.
 */
export async function getSeedImageFileKey(): Promise<string> {
  const hash = await getSeedImageHash()
  return `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`
}

/**
 * Attaches the bundled fixture image to one seed user (avatar) and one seed
 * list_item (image). Idempotent at both layers: we look up any pre-existing
 * images row by content hash and reuse it instead of running processImage
 * (which would otherwise insert a duplicate row — insertImage has no unique
 * constraint on `hash`), and both FK updates are no-ops when the target
 * already points at the same image.
 *
 * Must run after seedUsers and seedListItems (needs both FKs resolved).
 */
export async function seedImages(db: typeof Db): Promise<void> {
  const user = await db.query.users.findFirst({
    columns: { id: true, avatarImageId: true },
    where: eq(users.email, SEED_AVATAR_USER_EMAIL),
  })
  if (!user) {
    console.log('  images           0 rows (seed user missing)')
    return
  }

  const listItem = await db.query.listItems.findFirst({
    columns: { id: true, imageId: true },
    where: eq(listItems.id, SEED_LIST_ITEM_ID),
  })
  if (!listItem) {
    console.log('  images           0 rows (seed list_item missing)')
    return
  }

  const hash = await getSeedImageHash()
  const existing = await db.query.images.findFirst({
    columns: { id: true },
    where: eq(images.hash, hash),
  })

  let imageId: string
  if (existing) {
    imageId = existing.id
  } else {
    const buffer = await readFile(SEED_IMAGE_FIXTURE_PATH)
    const result = await processImage(buffer, user.id)
    if ('errorCode' in result) {
      console.log(`  images           0 rows (pipeline error: ${result.errorCode})`)
      return
    }
    imageId = result.image.id
  }

  if (user.avatarImageId !== imageId) {
    await db.update(users).set({ avatarImageId: imageId }).where(eq(users.id, user.id))
  }
  if (listItem.imageId !== imageId) {
    await db.update(listItems).set({ imageId }).where(eq(listItems.id, listItem.id))
  }

  const action = existing ? 'reused' : 'inserted'
  console.log(`  images           1 row (${action}; avatar + list_item attached)`)
}
