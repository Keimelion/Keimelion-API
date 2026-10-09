import type { db as Db } from '../../client.js'
import { categories } from './categories.schema.js'

const ROOT_CATEGORY_FIXTURES = [
  { slug: 'electronique', name: 'Électronique' },
  { slug: 'mode-accessoires', name: 'Mode & Accessoires' },
  { slug: 'maison-decoration', name: 'Maison & Décoration' },
  { slug: 'livres-medias', name: 'Livres & Médias' },
  { slug: 'sports-loisirs', name: 'Sports & Loisirs' },
  { slug: 'beaute-sante', name: 'Beauté & Santé' },
  { slug: 'jouets-jeux', name: 'Jouets & Jeux' },
  { slug: 'alimentation-boissons', name: 'Alimentation & Boissons' },
  { slug: 'voyage', name: 'Voyage' },
  { slug: 'autre', name: 'Autre' },
] as const

export async function seedCategories(db: typeof Db): Promise<void> {
  const rows = ROOT_CATEGORY_FIXTURES.map((fixture) => ({
    slug: fixture.slug,
    name: fixture.name,
    parentId: null,
    depth: 0,
  }))

  const inserted = await db
    .insert(categories)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: categories.id, slug: categories.slug })

  console.log(`  categories   ${String(inserted.length)} rows`)
}
