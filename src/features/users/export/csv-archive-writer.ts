import { Readable } from 'stream'
import { ZipArchive } from 'archiver'
import { Stringifier } from 'csv-stringify'
import type { ExportEntityDescriptor } from './export-entities.js'

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
  for (const row of rows) {
    stringifier.write(row)
  }
  stringifier.end()
  return stringifier
}

export async function buildExportZipStream(
  userId: string,
  entities: ExportEntityDescriptor[],
): Promise<ReadableStream<Uint8Array>> {
  const archive = new ZipArchive({ zlib: { level: 9 } })

  for (const entity of entities) {
    const csvStream = await buildEntityCsvStream(entity, userId)
    archive.append(csvStream, { name: entity.filename })
  }

  await archive.finalize()

  return Readable.toWeb(archive) as ReadableStream<Uint8Array>
}
