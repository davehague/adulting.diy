# Testing - Technical Reference

## Framework

- **Test Runner**: Vitest
- **Nuxt Integration**: @nuxt/test-utils
- **Configuration**: `vitest.config.ts`

## Test Structure

```
tests/
├── unit/                    # Unit tests for business logic
│   ├── utils/              # Date calculations, scheduling algorithms
│   └── logic/              # Notification preferences, business rules
├── integration/            # Integration tests for system components
├── e2e/                    # End-to-end tests (excluded from default run)
│   └── task-lifecycle.test.ts
├── fixtures/               # Shared test data and mocks
│   └── test-data.ts
└── setup.ts               # Global test configuration
```

## Commands

```bash
npm run test              # Run all tests (excludes e2e)
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

E2E tests are excluded from the default run via `vitest.config.ts` configuration.

## Coverage Areas

| Area | What's Tested |
|------|--------------|
| **Schedule Logic** | All 6 recurrence patterns, date calculations, edge cases |
| **Notification Logic** | User preferences, email templates, reminder timing |
| **Integration** | Scheduler endpoints, business rule validation |
| **E2E** | Task lifecycle (exists but excluded from default run) |
| **Edge Cases** | Timezone handling, month boundaries, leap years |

## Test Philosophy

1. **Unit tests** for core business logic (services, utilities, algorithms)
2. **Integration tests** for API endpoints and service interactions
3. **E2E tests** for task lifecycle workflows (exist but excluded from default run)
4. **Type tests** for TypeScript type validation

The test suite includes 41+ tests ensuring reliability of critical functionality including task scheduling, notification systems, and occurrence management.
