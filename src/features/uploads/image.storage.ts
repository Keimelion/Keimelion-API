import { readdir, rm } from 'fs/promises'
import { basename, dirname, join } from 'path'
import { env } from '../../config/env.js'

// On-disk layout: <UPLOADS_DIR>/<hash[0:2]>/<hash[2:4]>/<hash>-<width>.webp
const VARIANT_FILENAME_PATTERN = /^([0-9a-f]{64})-\d+\.webp$/

export function buildFileKey(hash: string): string {
  return `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`
}

export function buildVariantPath(fileKey: string, width: number): string {
  return join(env.UPLOADS_DIR, `${fileKey}-${String(width)}.webp`)
}

export async function listStoredImageHashes(): Promise<string[]> {
  const entries = await readUploadsDir()
  const hashes = entries.map((entry) => VARIANT_FILENAME_PATTERN.exec(basename(entry))?.[1])
  return Array.from(new Set(hashes.filter((hash): hash is string => hash !== undefined)))
}

async function readUploadsDir(): Promise<string[]> {
  try {
    return await readdir(env.UPLOADS_DIR, { recursive: true })
  } catch (error: unknown) {
    if (isMissingPathError(error)) return []
    throw error
  }
}

// Removes every variant of the hash, whatever widths were generated at upload time.
export async function deleteStoredImageFiles(hash: string): Promise<void> {
  const directory = join(env.UPLOADS_DIR, dirname(buildFileKey(hash)))
  const filenames = await readdir(directory).catch((error: unknown) => {
    if (isMissingPathError(error)) return []
    throw error
  })
  const variants = filenames.filter((filename) => filename.startsWith(`${hash}-`))
  await Promise.all(variants.map((filename) => rm(join(directory, filename), { force: true })))
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
