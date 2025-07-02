import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**/*.test.ts'], // Exclude E2E tests for now
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        'prisma/',
        '.nuxt/',
        'dist/',
        'coverage/'
      ]
    },
    testTimeout: 30000,
    hookTimeout: 30000
  },
  nuxt: {
    config: './nuxt.config.test.ts'
  }
})