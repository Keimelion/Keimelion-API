import { db } from '../../db/client.js'
import { feedback } from '../../db/entities/feedback/feedback.schema.js'
import type { Feedback } from '../../db/entities/feedback/feedback.schema.js'

interface InsertFeedbackInput {
  userId: string | null
  title: string
  description: string
  context: Record<string, unknown> | null
}

export async function insertFeedback(input: InsertFeedbackInput): Promise<Feedback | undefined> {
  const [row] = await db.insert(feedback).values(input).returning()
  return row
}
