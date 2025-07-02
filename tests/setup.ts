import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock environment variables for testing
vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id')
vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret')
vi.stubEnv('MAILJET_API_KEY', 'test-mailjet-key')
vi.stubEnv('MAILJET_SECRET_KEY', 'test-mailjet-secret')
vi.stubEnv('MAILJET_FROM_EMAIL', 'test@example.com')
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test')

// Mock Google Sign-In plugin
vi.mock('nuxt-vue3-google-signin', () => ({
  default: vi.fn(),
}))

// Mock Prisma client for unit tests
vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    household: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    taskDefinition: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    taskOccurrence: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userNotificationPreferences: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    occurrenceHistoryLog: {
      create: vi.fn(),
    },
  }
}))

// Mock authentication helpers
vi.mock('@/server/utils/auth/helpers', () => ({
  verifyGoogleToken: vi.fn().mockResolvedValue({
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg'
  }),
  getUserFromBearerToken: vi.fn().mockResolvedValue({
    id: 'user-test-123',
    email: 'test@example.com',
    name: 'Test User',
    householdId: 'household-test-123',
    isAdmin: true
  })
}))

// Mock Mailjet
vi.mock('node-mailjet', () => ({
  connect: vi.fn(() => ({
    post: vi.fn(() => ({
      request: vi.fn().mockResolvedValue({
        body: { Messages: [{ Status: 'success' }] }
      })
    }))
  }))
}))

// Mock console.log in tests to reduce noise
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: console.error, // Keep error for debugging
}

// Increase timeout for database operations
vi.setConfig({ testTimeout: 30000 })