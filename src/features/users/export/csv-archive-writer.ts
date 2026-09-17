import { Readable } from 'stream'
import { ZipArchive } from 'archiver'
import { Stringifier } from 'csv-stringify'
import { logger } from '../../../shared/utils/logger.js'
import type { ExportEntityDescriptor } from './export-entities.js'

export async function buildExportZipStream(
  userId: string,
  entities: ExportEntityDescriptor[],
): Promise<ReadableStream<Uint8Array>> {
  const archive = new ZipArchive({ zlib: { level: 9 } })
  const entityNames = entities.map((entity) => entity.filename)

  archive.on('error', (error) => {
    logger.error({ error, userId, entities: entityNames }, 'Export archive stream error')
  })
  archive.on('warning', (error) => {
    logger.warn({ error, userId, entities: entityNames }, 'Export archive stream warning')
  })

  for (const entity of entities) {
    const csvStream = await buildEntityCsvStream(entity, userId)
    archive.append(csvStream, { name: entity.filename })
  }

  archive.finalize().catch((error: unknown) => {
    logger.error({ error, userId, entities: entityNames }, 'Export archive finalize failed')
  })

  return Readable.toWeb(archive) as ReadableStream<Uint8Array>
}

async function buildEntityCsvStream(
  entity: ExportEntityDescriptor,
  userId: string,
): Promise<Readable> {
  const rows = await entity.fetchRows(userId)
  const stringifier = new Stringifier({
    header: true,
    columns: entity.columns,
    escape_formulas: true,
  })
  rows.forEach((row) => stringifier.write(row))
  stringifier.end()
  return stringifier
}
