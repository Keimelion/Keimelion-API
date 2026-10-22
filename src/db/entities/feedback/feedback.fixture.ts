import type { db as Db } from '../../client.js'
import { FeedbackStatuses } from '../../../shared/enums/feedback-status.js'
import { feedback } from './feedback.schema.js'
import type { FeedbackStatus } from '../../../shared/enums/feedback-status.js'

interface FeedbackFixture {
  id: string
  authorEmail: string
  title: string
  description: string
  status: FeedbackStatus
  context: Record<string, unknown> | null
}

const FEEDBACK_FIXTURES: readonly FeedbackFixture[] = [
  {
    id: '7d3f0b40-0006-4b60-8000-000000000001',
    authorEmail: 'user@example.com',
    title: 'Impossible de supprimer un article',
    description:
      "Le bouton 'supprimer' sur la page d'une liste n'a aucun effet quand je clique dessus.",
    status: FeedbackStatuses.OPEN,
    context: {
      route: '/lists/mon-anniversaire-dev01',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) Chrome/126.0.0.0 Safari/537.36',
      locale: 'fr',
    },
  },
  {
    id: '7d3f0b40-0006-4b60-8000-000000000002',
    authorEmail: 'moderator@example.com',
    title: 'Suggestion : filtrer les listes par tag',
    description:
      "Ce serait utile d'avoir un filtre par tag sur la vue 'Mes listes' pour retrouver vite une liste.",
    status: FeedbackStatuses.REVIEWED,
    context: null,
  },
  {
    id: '7d3f0b40-0006-4b60-8000-000000000003',
    authorEmail: 'user@example.com',
    title: 'Typo dans la page de création de liste',
    description: "La page affichait 'liste des envie' au lieu de 'liste d'envies'. Corrigé depuis.",
    status: FeedbackStatuses.CLOSED,
    context: null,
  },
]

export async function seedFeedback(db: typeof Db): Promise<void> {
  const userRows = await db.query.users.findMany({ columns: { id: true, email: true } })
  const userIdByEmail = new Map(userRows.map((row) => [row.email, row.id]))

  const values = FEEDBACK_FIXTURES.flatMap((fixture) => {
    const userId = userIdByEmail.get(fixture.authorEmail)
    if (!userId) return []
    return [
      {
        id: fixture.id,
        userId,
        title: fixture.title,
        description: fixture.description,
        status: fixture.status,
        context: fixture.context,
      },
    ]
  })

  if (values.length === 0) {
    console.log(`  feedback         0 rows`)
    return
  }

  const inserted = await db
    .insert(feedback)
    .values(values)
    .onConflictDoNothing({ target: feedback.id })
    .returning({ id: feedback.id })

  console.log(`  feedback         ${String(inserted.length)} rows`)
}
