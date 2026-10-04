import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/server/utils/prisma/client'

// Nitro auto-imports defineEventHandler; stand in with the identity so handlers are callable.
vi.hoisted(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

const verifyIdToken = vi.hoisted(() => vi.fn())
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn(() => ({ verifyIdToken })),
}))

const devBypass = vi.hoisted(() => ({ enabled: false }))
vi.mock('@/server/utils/dev-auth', () => ({
  devAuthService: {
    isDevBypassEnabled: () => devBypass.enabled,
    getUserById: vi.fn(),
  },
}))

vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  readBody: vi.fn(),
}))

import { readBody } from 'h3'
import { devAuthService } from '@/server/utils/dev-auth'
import { verifyAuth } from '@/server/utils/auth'
import getProfile from '@/server/api/user/profile.get'
import register from '@/server/api/user/register.post'

interface Row {
  id: string
  email: string
  name: string
  householdId: string | null
  isAdmin: boolean
}

const alice: Row = { id: 'u-alice', email: 'alice@example.com', name: 'Alice', householdId: 'h-1', isAdmin: true }
const bob: Row = { id: 'u-bob', email: 'bob@example.com', name: 'Bob', householdId: 'h-2', isAdmin: false }

let rows: Row[] = []

// A token is just "token:<email>" here; the mocked verifier turns it into a payload.
const tokenPayload = (email: string, extra: Record<string, unknown> = {}) => ({
  email,
  email_verified: true,
  iss: 'https://accounts.google.com',
  exp: Math.floor(Date.now() / 1000) + 3600,
  name: `Google ${email}`,
  picture: `https://pics.example.com/${email}`,
  ...extra,
})

const eventFor = ({ token, query = '', devUserId }: { token?: string; query?: string; devUserId?: string } = {}) => {
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  if (devUserId) headers['x-dev-user-id'] = devUserId
  const path = `/api/user/x${query}`
  return { path, node: { req: { headers, url: path } }, context: {} } as any
}

describe('public user routes require a verified identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    devBypass.enabled = false
    rows = [alice, bob]

    verifyIdToken.mockImplementation(async ({ idToken }: { idToken: string }) => {
      if (!idToken.startsWith('token:')) throw new Error('bad signature')
      return { getPayload: () => tokenPayload(idToken.slice('token:'.length)) }
    })
    vi.mocked(prisma.user.findUnique).mockImplementation((async ({ where }: any) =>
      rows.find(r => r.email === where.email || r.id === where.id) ?? null) as any)
    vi.mocked(prisma.user.create).mockImplementation((async ({ data }: any) => ({
      id: 'u-new', householdId: null, isAdmin: false, ...data,
    })) as any)
    vi.mocked(prisma.user.update).mockImplementation((async ({ where }: any) =>
      rows.find(r => r.id === where.id)) as any)
    vi.mocked(devAuthService.getUserById).mockImplementation(
      async (id: string) => (rows.find(r => r.id === id) ?? null) as any
    )
    vi.mocked(readBody).mockResolvedValue({ email: alice.email, name: 'Alice' })
  })

  describe('GET /api/user/profile', () => {
    it('returns 401 with no token, even when an email is supplied', async () => {
      await expect(getProfile(eventFor({ query: `?email=${bob.email}` })))
        .rejects.toMatchObject({ statusCode: 401 })
    })

    it('returns 401 for a token that fails verification', async () => {
      await expect(getProfile(eventFor({ token: 'forged' }))).rejects.toMatchObject({ statusCode: 401 })
    })

    it('returns 401 for an unverified email', async () => {
      verifyIdToken.mockResolvedValue({ getPayload: () => tokenPayload(alice.email, { email_verified: false }) })
      await expect(getProfile(eventFor({ token: 'token:alice' }))).rejects.toMatchObject({ statusCode: 401 })
    })

    it("returns the token owner's row", async () => {
      await expect(getProfile(eventFor({ token: `token:${alice.email}` })))
        .resolves.toMatchObject({ id: alice.id })
    })

    it('accepts the caller\'s own email in the query (case-insensitive)', async () => {
      await expect(getProfile(eventFor({ token: `token:${alice.email}`, query: '?email=ALICE@example.com' })))
        .resolves.toMatchObject({ id: alice.id })
    })

    it("refuses to read another user's profile with a valid token (403)", async () => {
      await expect(getProfile(eventFor({ token: `token:${alice.email}`, query: `?email=${bob.email}` })))
        .rejects.toMatchObject({ statusCode: 403 })
    })

    it('returns 404 for a valid token with no user row (login relies on this)', async () => {
      await expect(getProfile(eventFor({ token: 'token:new@example.com' })))
        .rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('POST /api/user/register', () => {
    it('returns 401 with no token and creates nothing', async () => {
      await expect(register(eventFor())).rejects.toMatchObject({ statusCode: 401 })
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('returns 401 for a forged token', async () => {
      await expect(register(eventFor({ token: 'forged' }))).rejects.toMatchObject({ statusCode: 401 })
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it("creates the row for the token's email and ignores the body's email", async () => {
      vi.mocked(readBody).mockResolvedValue({ email: bob.email, name: 'Body Name', emailVerified: false })

      const created: any = await register(eventFor({ token: 'token:new@example.com' }))

      expect(created.email).toBe('new@example.com')
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ email: 'new@example.com' }),
      })
    })

    it('prefers name and picture from the token over the body', async () => {
      vi.mocked(readBody).mockResolvedValue({ name: 'Body Name', picture: 'https://evil.example.com/x.png' })

      await register(eventFor({ token: 'token:new@example.com' }))

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Google new@example.com',
          picture: 'https://pics.example.com/new@example.com',
        }),
      })
    })

    it('falls back to the body name when the token has none', async () => {
      verifyIdToken.mockResolvedValue({
        getPayload: () => tokenPayload('new@example.com', { name: undefined, picture: undefined }),
      })
      vi.mocked(readBody).mockResolvedValue({ name: 'Body Name' })

      await register(eventFor({ token: 'token:new@example.com' }))

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ email: 'new@example.com', name: 'Body Name' }),
      })
    })

    it("cannot read another user's row by posting their email", async () => {
      vi.mocked(readBody).mockResolvedValue({ email: bob.email, name: 'Bob' })

      const result: any = await register(eventFor({ token: 'token:new@example.com' }))

      expect(result.id).not.toBe(bob.id)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('for an existing user, only touches the token owner', async () => {
      vi.mocked(readBody).mockResolvedValue({ email: bob.email, name: 'Bob' })

      const result: any = await register(eventFor({ token: `token:${alice.email}` }))

      expect(result.id).toBe(alice.id)
      expect(vi.mocked(prisma.user.update).mock.calls[0][0]).toMatchObject({ where: { id: alice.id } })
    })
  })

  describe('dev login bypass', () => {
    it('lets profile and register resolve the dev user with no token when enabled', async () => {
      devBypass.enabled = true

      await expect(getProfile(eventFor({ devUserId: alice.id }))).resolves.toMatchObject({ id: alice.id })
      await expect(register(eventFor({ devUserId: alice.id }))).resolves.toMatchObject({ id: alice.id })
    })

    it('still rejects another email for a dev user (403)', async () => {
      devBypass.enabled = true

      await expect(getProfile(eventFor({ devUserId: alice.id, query: `?email=${bob.email}` })))
        .rejects.toMatchObject({ statusCode: 403 })
    })

    it('is rejected on both routes when the bypass is disabled', async () => {
      devBypass.enabled = false

      await expect(getProfile(eventFor({ devUserId: alice.id }))).rejects.toMatchObject({ statusCode: 401 })
      await expect(register(eventFor({ devUserId: alice.id }))).rejects.toMatchObject({ statusCode: 401 })
    })
  })

  describe('verifyAuth (unchanged behaviour)', () => {
    it('resolves the user row for a valid token', async () => {
      await expect(verifyAuth(eventFor({ token: `token:${alice.email}` })))
        .resolves.toEqual({ email: alice.email, userId: alice.id, householdId: 'h-1' })
    })

    it('still returns 401 for a valid token with no user row', async () => {
      await expect(verifyAuth(eventFor({ token: 'token:new@example.com' })))
        .rejects.toMatchObject({ statusCode: 401 })
    })

    it('still returns 401 with no token', async () => {
      await expect(verifyAuth(eventFor())).rejects.toMatchObject({ statusCode: 401 })
    })
  })
})
