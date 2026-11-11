import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { env } from '../../config/env.js'
import {
  buildFileKey,
  buildVariantPath,
  deleteStoredImageFiles,
  listStoredImageHashes,
} from './image.storage.js'

const HASH_A = 'a'.repeat(64)
const HASH_B = 'ab' + 'b'.repeat(62)

async function writeVariant(hash: string, width: number): Promise<string> {
  const path = buildVariantPath(buildFileKey(hash), width)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, 'webp')
  return path
}

describe('image.storage', () => {
  const originalUploadsDir = env.UPLOADS_DIR

  beforeEach(async () => {
    env.UPLOADS_DIR = await mkdtemp(join(tmpdir(), 'keimelion-storage-'))
  })

  afterEach(async () => {
    await rm(env.UPLOADS_DIR, { recursive: true, force: true })
    env.UPLOADS_DIR = originalUploadsDir
  })

  it('lists each stored hash once, ignoring unrelated files', async () => {
    await writeVariant(HASH_A, 300)
    await writeVariant(HASH_A, 800)
    await writeVariant(HASH_B, 300)
    await writeFile(join(env.UPLOADS_DIR, '.gitkeep'), '')

    const hashes = await listStoredImageHashes()

    expect(hashes.sort()).toEqual([HASH_A, HASH_B].sort())
  })

  it('returns no hash when the uploads directory does not exist', async () => {
    await rm(env.UPLOADS_DIR, { recursive: true, force: true })

    expect(await listStoredImageHashes()).toEqual([])
  })

  it('deletes every variant of the hash and nothing else', async () => {
    const keptPath = await writeVariant(HASH_B, 300)
    await writeVariant(HASH_A, 300)
    await writeVariant(HASH_A, 1600)

    await deleteStoredImageFiles(HASH_A)

    expect(await readdir(dirname(buildVariantPath(buildFileKey(HASH_A), 300)))).toEqual([])
    expect(await readdir(dirname(keptPath))).toHaveLength(1)
  })

  it('does nothing when the hash directory is already gone', async () => {
    await expect(deleteStoredImageFiles(HASH_A)).resolves.toBeUndefined()
  })
})
