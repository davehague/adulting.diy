import { describe, it, expect, vi, beforeEach } from 'vitest'

// Nitro auto-imports defineEventHandler; stand in with the identity so handlers are callable.
vi.hoisted(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

const service = vi.hoisted(() => ({
  listForProject: vi.fn(),
  link: vi.fn(),
  setStatus: vi.fn(),
  unlink: vi.fn(),
}))

vi.mock('@/server/services/ProjectProviderService', () => ({
  ProjectProviderService: vi.fn(() => service),
}))

// Sign in through the dev bypass so the real auth wrapper runs.
vi.mock('@/server/utils/dev-auth', () => ({
  devAuthService: {
    isDevBypassEnabled: () => true,
    getUserById: vi.fn(),
  },
}))

vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  readBody: vi.fn(),
}))

import { readBody } from 'h3'
import { devAuthService } from '@/server/utils/dev-auth'
import { HttpError } from '@/server/utils/api-errors'
import listRoute from '@/server/api/projects/[id]/providers.get'
import linkRoute from '@/server/api/projects/[id]/providers.post'
import statusRoute from '@/server/api/projects/[id]/providers/[providerId].put'
import unlinkRoute from '@/server/api/projects/[id]/providers/[providerId].delete'

type Handler = (event: unknown) => Promise<unknown>

const call = (handler: unknown, userId: string | null, params: Record<string, string> = {}) =>
  (handler as Handler)({
    node: { req: { headers: userId ? { 'x-dev-user-id': userId } : {} } },
    context: { params },
  })

const links = [{ providerId: 'pr1', status: 'considering', provider: { id: 'pr1', name: 'Acme', phone: null, neighborCount: 0 } }]

describe('project provider routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(devAuthService.getUserById).mockImplementation((async (id: string) => {
      if (id === 'u1') return { id: 'u1', name: 'u1', email: 'u1@example.com', householdId: 'h1' }
      if (id === 'loner') return { id: 'loner', name: 'loner', email: 'loner@example.com', householdId: null }
      return null
    }) as never)
    service.listForProject.mockResolvedValue(links)
    service.link.mockResolvedValue(links)
    service.setStatus.mockResolvedValue(links)
    service.unlink.mockResolvedValue([])
  })

  describe('GET /api/projects/:id/providers', () => {
    it('lists for the caller household', async () => {
      await expect(call(listRoute, 'u1', { id: 'p1' })).resolves.toEqual(links)
      expect(service.listForProject).toHaveBeenCalledWith('h1', 'p1')
    })

    it('rejects a caller who is not signed in with 401', async () => {
      await expect(call(listRoute, null, { id: 'p1' })).rejects.toMatchObject({ statusCode: 401 })
      expect(service.listForProject).not.toHaveBeenCalled()
    })

    it('rejects a caller with no household with 403', async () => {
      await expect(call(listRoute, 'loner', { id: 'p1' })).rejects.toMatchObject({ statusCode: 403 })
      expect(service.listForProject).not.toHaveBeenCalled()
    })

    it('passes a service 404 through with its message', async () => {
      service.listForProject.mockRejectedValue(new HttpError('Project not found', 404))
      await expect(call(listRoute, 'u1', { id: 'p1' })).rejects.toMatchObject({ statusCode: 404, message: 'Project not found' })
    })
  })

  describe('POST /api/projects/:id/providers', () => {
    it('links with the caller household and user id, and returns the list', async () => {
      vi.mocked(readBody).mockResolvedValue({ providerId: 'pr1' })
      await expect(call(linkRoute, 'u1', { id: 'p1' })).resolves.toEqual(links)
      expect(service.link).toHaveBeenCalledWith('h1', 'u1', 'p1', 'pr1')
    })

    it('rejects a body with no provider id with 400 and does not call the service', async () => {
      for (const body of [{}, { providerId: '' }, null, undefined]) {
        vi.mocked(readBody).mockResolvedValue(body)
        await expect(call(linkRoute, 'u1', { id: 'p1' })).rejects.toMatchObject({ statusCode: 400, message: 'Provider is required' })
      }
      expect(service.link).not.toHaveBeenCalled()
    })

    it('passes a service 409 through with its message', async () => {
      vi.mocked(readBody).mockResolvedValue({ providerId: 'pr1' })
      service.link.mockRejectedValue(new HttpError('That provider is already on this project', 409))
      await expect(call(linkRoute, 'u1', { id: 'p1' })).rejects.toMatchObject({
        statusCode: 409, message: 'That provider is already on this project',
      })
    })

    it('hides an unexpected failure behind a 500', async () => {
      vi.mocked(readBody).mockResolvedValue({ providerId: 'pr1' })
      service.link.mockRejectedValue(new Error('connection lost'))
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
      await expect(call(linkRoute, 'u1', { id: 'p1' })).rejects.toMatchObject({ statusCode: 500, message: 'Server error' })
      logged.mockRestore()
    })
  })

  describe('PUT /api/projects/:id/providers/:providerId', () => {
    it('sets the status and returns the list', async () => {
      vi.mocked(readBody).mockResolvedValue({ status: 'chosen' })
      await expect(call(statusRoute, 'u1', { id: 'p1', providerId: 'pr1' })).resolves.toEqual(links)
      expect(service.setStatus).toHaveBeenCalledWith('h1', 'p1', 'pr1', 'chosen')
    })

    it('rejects an unknown or missing status with 400 and does not call the service', async () => {
      for (const body of [{ status: 'hired' }, {}, { status: '' }]) {
        vi.mocked(readBody).mockResolvedValue(body)
        await expect(call(statusRoute, 'u1', { id: 'p1', providerId: 'pr1' })).rejects.toMatchObject({ statusCode: 400, message: 'Unknown status' })
      }
      expect(service.setStatus).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /api/projects/:id/providers/:providerId', () => {
    it('unlinks and returns the remaining list', async () => {
      await expect(call(unlinkRoute, 'u1', { id: 'p1', providerId: 'pr1' })).resolves.toEqual([])
      expect(service.unlink).toHaveBeenCalledWith('h1', 'p1', 'pr1')
    })

    it('passes a service 404 through with its message', async () => {
      service.unlink.mockRejectedValue(new HttpError('That provider is not on this project', 404))
      await expect(call(unlinkRoute, 'u1', { id: 'p1', providerId: 'pr1' })).rejects.toMatchObject({
        statusCode: 404, message: 'That provider is not on this project',
      })
    })
  })
})
