import { eq } from 'drizzle-orm'
import { db } from '../../client.js'
import { lists } from './lists.schema.js'
import type { List } from './lists.schema.js'

export function findListById(id: string): Promise<List | undefined> {
  return db.query.lists.findFirst({ where: eq(lists.id, id) })
}
