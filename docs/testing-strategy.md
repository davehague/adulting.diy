# Testing Strategy for Adulting.DIY

## Overview

This document outlines the comprehensive testing strategy for the Adulting.DIY household task management application. We'll implement multiple testing layers to ensure all major user workflows function correctly.

## Testing Pyramid

### 1. Unit Tests (Foundation)
- **Services**: TaskService, OccurrenceService, NotificationService
- **Utilities**: Schedule calculation functions, date helpers
- **Components**: Vue components in isolation
- **Types**: TypeScript type validation

### 2. Integration Tests (API Layer)
- **Authentication**: OAuth flow, session management
- **CRUD Operations**: Tasks, occurrences, household management
- **Business Logic**: Task scheduling, notification sending
- **Data Persistence**: Database operations

### 3. End-to-End Tests (User Workflows)
- **Complete user journeys**: From signup to task completion
- **Cross-browser compatibility**
- **Real database and email service interaction**

## Major User Workflows to Test

### Workflow 1: User Onboarding
1. **Google OAuth signup**
2. **Create or join household**
3. **Set notification preferences**
4. **Navigate dashboard**

### Workflow 2: Task Management Lifecycle
1. **Create task with recurrence pattern**
2. **Edit task details and schedule**
3. **Pause/unpause task**
4. **Delete task (soft delete)**

### Workflow 3: Occurrence Handling
1. **View pending occurrences**
2. **Complete occurrence**
3. **Skip occurrence with reason**  
4. **Add comments to occurrence**
5. **Reassign occurrence**
6. **Change due date**

### Workflow 4: Scheduling System
1. **Automatic occurrence generation**
2. **Different recurrence patterns**:
   - Once
   - Fixed interval (daily, weekly, monthly, yearly)
   - Specific days of week
   - Specific day of month
   - Specific weekday of month
   - Variable interval (after completion)
3. **End conditions**: Never, after N times, until date
4. **Next occurrence creation after completion/skip**

### Workflow 5: Notification System
1. **Task creation notifications**
2. **Occurrence assignment notifications**
3. **Completion/skip notifications**
4. **Comment notifications**
5. **Reminder notifications**:
   - Initial reminder
   - Follow-up reminder
   - Overdue reminder
6. **User preference filtering** (any/mine/none)

### Workflow 6: Household Collaboration
1. **Multi-user household setup**
2. **Task assignment between users**
3. **Cross-user notifications**
4. **Admin privileges**
5. **Custom category creation**

## Testing Framework Selection

### Primary Stack
- **Vitest**: Modern, fast test runner with TypeScript support
- **@nuxt/test-utils**: Nuxt-specific testing utilities
- **@vue/test-utils**: Vue component testing
- **Playwright**: End-to-end browser testing

### Supporting Tools
- **msw**: API mocking for isolated tests
- **@testing-library/vue**: User-centric testing approach
- **testcontainers**: Database testing with Docker

## Test Organization

```
tests/
├── unit/
│   ├── services/
│   ├── utils/
│   └── components/
├── integration/
│   ├── api/
│   └── database/
├── e2e/
│   ├── workflows/
│   └── fixtures/
└── helpers/
    ├── test-setup.ts
    ├── database-helpers.ts
    └── auth-mocks.ts
```

## Critical Test Scenarios

### High Priority
1. **All recurrence patterns generate correct occurrences**
2. **Notification preferences control email sending**
3. **Multi-user household data isolation**
4. **Task completion triggers next occurrence**
5. **End conditions stop occurrence generation**

### Medium Priority
1. **UI responsiveness and accessibility**
2. **Error handling and edge cases**
3. **Performance with large datasets**
4. **Email template rendering**

### Low Priority
1. **Browser compatibility**
2. **Mobile responsiveness**
3. **Advanced filtering and search**

## Success Criteria

- **95%+ code coverage** for critical business logic
- **All major workflows pass** end-to-end tests
- **Zero flaky tests** in CI/CD pipeline
- **Performance benchmarks met** (API response times <500ms)
- **Accessibility standards compliance** (WCAG 2.1 AA)

## Test Data Strategy

### Fixtures
- **Test households** with multiple users
- **Task definitions** covering all recurrence patterns
- **Occurrence data** in various states
- **Email templates** for notification testing

### Database
- **Isolated test database** for each test run
- **Transaction rollback** for unit tests
- **Seeded data** for consistent testing
- **Cleanup procedures** for integration tests