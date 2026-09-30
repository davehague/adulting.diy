import { describe, it, expect, vi } from 'vitest'
import { assertHouseholdAdmin } from '@/server/utils/admin'

describe('assertHouseholdAdmin', () => {
  it('resolves for admins', async () => {
    await expect(assertHouseholdAdmin('u', 'h', vi.fn().mockResolvedValue(true))).resolves.toBeUndefined()
  })
  it('throws 403 for non-admins', async () => {
    await expect(assertHouseholdAdmin('u', 'h', vi.fn().mockResolvedValue(false)))
      .rejects.toMatchObject({ statusCode: 403 })
  })
})
