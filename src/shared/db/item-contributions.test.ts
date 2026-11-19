import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ItemContributionActions } from '@keimelion/sdk/enums'
import { db } from '../../db/client.js'
import type { DbTransaction } from '../../db/client.js'
import { recordItemContribution } from './item-contributions.js'

const PREVIOUS = { name: 'Old name', description: null, gtin: null, imageId: null }

function mockInsertValues(): ReturnType<typeof vi.fn> {
  const values = vi.fn().mockResolvedValue(undefined)
  vi.mocked(db.insert).mockReturnValueOnce({ values } as never)
  return values
}

describe('recordItemContribution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps only the tracked fields of the patch in the changes', async () => {
    const values = mockInsertValues()
    const patch = { name: 'New name', updatedAt: new Date() } as never

    await recordItemContribution(
      { itemId: 'item-id', userId: 'user-id', action: ItemContributionActions.ADMIN_UPDATE, previous: PREVIOUS, patch },
      db as unknown as DbTransaction,
    )

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      changes: { name: { from: 'Old name', to: 'New name' } },
    }))
  })

  it('inserts nothing when only untracked fields are patched', async () => {
    const patch = { updatedAt: new Date() } as never

    await recordItemContribution(
      { itemId: 'item-id', userId: 'user-id', action: ItemContributionActions.ADMIN_UPDATE, previous: PREVIOUS, patch },
      db as unknown as DbTransaction,
    )

    expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
  })
})
