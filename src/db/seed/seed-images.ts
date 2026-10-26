import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import { eq } from 'drizzle-orm'
import type { db as Db } from '../client.js'
import { processImage } from '../../features/uploads/image.pipeline.js'
import { users } from '../entities/users/users.schema.js'
import { listItems } from '../entities/list-items/list-items.schema.js'
import { images } from '../entities/images/images.schema.js'

/**
 * Fixture images bundled with the repo and run through the real {@link processImage}
 * pipeline at seed time, so the dev DB has a real avatar + a real list_item image
 * after `npm run db:seed` — otherwise the Backoffice thumbnails and avatars all
 * fall back to the placeholder.
 */
export const SEED_AVATAR_FIXTURE_PATH = 'src/db/seed/fixtures/sample-avatar.jpg'
export const SEED_PRODUCT_FIXTURE_PATH = 'src/db/seed/fixtures/sample-product.jpg'

const SEED_AVATAR_USER_EMAIL = 'user@example.com'
const SEED_LIST_ITEM_ID = '7d3f0b40-0005-4b60-8000-000000000001'

async function hashFixture(path: string): Promise<string> {
  const buffer = await readFile(path)
  return createHash('sha256').update(buffer).digest('hex')
}

function fileKeyFromHash(hash: string): string {
  return `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`
}

/**
 * Returns the content-addressed file keys (same `aa/bb/<hash>` layout as the
 * production pipeline) for both bundled fixtures, so `reset.ts` can locate the
 * generated variant files on disk without having to replay the pipeline.
 */
export async function getSeedImageFileKeys(): Promise<string[]> {
  const [avatarHash, productHash] = await Promise.all([
    hashFixture(SEED_AVATAR_FIXTURE_PATH),
    hashFixture(SEED_PRODUCT_FIXTURE_PATH),
  ])
  return [fileKeyFromHash(avatarHash), fileKeyFromHash(productHash)]
}

interface UpsertedImage {
  id: string
  inserted: boolean
}

async function upsertFixtureImage(
  db: typeof Db,
  fixturePath: string,
  uploadedBy: string,
): Promise<UpsertedImage | null> {
  const hash = await hashFixture(fixturePath)
  const existing = await db.query.images.findFirst({
    columns: { id: true },
    where: eq(images.hash, hash),
  })
  if (existing) {
    return { id: existing.id, inserted: false }
  }
  const buffer = await readFile(fixturePath)
  const result = await processImage(buffer, uploadedBy)
  if ('errorCode' in result) {
    return null
  }
  return { id: result.image.id, inserted: true }
}

/**
 * Attaches the bundled fixtures to one seed user (avatar) and one seed list_item
 * (product image). Idempotent at both layers: pre-existing images rows are reused
 * by content hash (insertImage has no unique constraint on `hash`), and both FK
 * updates are no-ops when the target already points at the same image.
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

  const avatar = await upsertFixtureImage(db, SEED_AVATAR_FIXTURE_PATH, user.id)
  if (!avatar) {
    console.log('  images           0 rows (avatar pipeline error)')
    return
  }
  const product = await upsertFixtureImage(db, SEED_PRODUCT_FIXTURE_PATH, user.id)
  if (!product) {
    console.log('  images           1 row (product pipeline error; avatar skipped)')
    return
  }

  if (user.avatarImageId !== avatar.id) {
    await db.update(users).set({ avatarImageId: avatar.id }).where(eq(users.id, user.id))
  }
  if (listItem.imageId !== product.id) {
    await db.update(listItems).set({ imageId: product.id }).where(eq(listItems.id, listItem.id))
  }

  const avatarAction = avatar.inserted ? 'inserted' : 'reused'
  const productAction = product.inserted ? 'inserted' : 'reused'
  console.log(`  images           2 rows (avatar ${avatarAction}, product ${productAction})`)
}
