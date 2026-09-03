import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../client.js'
import { deleteExpiredTokens } from './access-tokens.repository.js'

describe('deleteExpiredTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the count of deleted rows', async () => {
    const deletedRows = [
      { tokenId: '00000000-0000-0000-0000-000000000001' },
      { tokenId: '00000000-0000-0000-0000-000000000002' },
    ]
    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce(deletedRows),
      }),
    } as never)

    const count = await deleteExpiredTokens()

    expect(count).toBe(2)
    expect(vi.mocked(db.delete)).toHaveBeenCalledOnce()
  })

  it('returns zero when no expired rows exist', async () => {
    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([]),
      }),
    } as never)

    const count = await deleteExpiredTokens()

    expect(count).toBe(0)
  })

  it('propagates errors thrown by the db client', async () => {
    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockRejectedValueOnce(new Error('DB connection lost')),
      }),
    } as never)

    await expect(deleteExpiredTokens()).rejects.toThrow('DB connection lost')
  })
})
