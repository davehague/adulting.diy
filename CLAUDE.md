# Adulting.DIY - Claude Development Guide

## Project Overview

Adulting.DIY is a household task management system designed to help families and households collaborate on shared responsibilities. It's a web application built with modern technologies that allows users to create, assign, track, and manage recurring and one-time tasks.

## Tech Stack

### Frontend
- **Framework**: Nuxt 3 (Vue 3) with TypeScript
- **State Management**: Pinia with persisted state
- **Styling**: Tailwind CSS
- **Icons**: Lucide Vue Next, Heroicons
- **Authentication**: Google Sign-In (OAuth2)

### Backend
- **Server**: Nuxt 3 server routes (Nitro)
- **Database**: CockroachDB (PostgreSQL-compatible)
- **ORM**: Prisma
- **Email Service**: Mailjet (for notifications)

### Development & Deployment
- **Hosting**: Vercel
- **Local HTTPS**: mkcert for SSL certificates
- **Package Manager**: npm

## Architecture Overview

The application follows a typical full-stack architecture with:

1. **Multi-tenancy**: Household-based isolation of data
2. **Service Layer Pattern**: Business logic encapsulated in service classes
3. **API-first Design**: RESTful API endpoints for all operations
4. **Type Safety**: Comprehensive TypeScript types throughout

## Key Concepts

### Data Models

1. **User**: Individual users with Google OAuth authentication
2. **Household**: Groups of users sharing tasks
3. **TaskDefinition**: Templates for tasks with scheduling rules
4. **TaskOccurrence**: Specific instances of tasks that need completion
5. **Category**: Organization system for tasks (predefined + custom)
6. **OccurrenceHistoryLog**: Audit trail for task occurrences

### Task Scheduling System

Tasks support various recurrence patterns:
- **Once**: Single occurrence tasks
- **Fixed Interval**: Every X days/weeks/months/years
- **Specific Days of Week**: e.g., Every Monday and Friday
- **Specific Day of Month**: e.g., 15th of each month
- **Specific Weekday of Month**: e.g., First Monday of each month
- **Variable Interval**: X days after last completion

### Authentication Flow

1. Users authenticate via Google OAuth
2. Bearer token sent in Authorization header
3. Server validates token and retrieves user from database
4. Household membership verified for protected routes

## Project Structure

```
adulting.diy/
├── app.vue                 # Root application component
├── components/            # Vue components
│   ├── AppHeader.vue
│   ├── AppFooter.vue
│   ├── occurrences/      # Occurrence-related components
│   └── tasks/            # Task-related components
├── composables/          # Vue composables
├── docs/                 # Project documentation
│   └── llm-workflow/     # Development planning docs
├── layouts/              # Nuxt layouts
├── middleware/           # Route middleware
├── pages/                # Nuxt pages (file-based routing)
│   ├── home.vue
│   ├── login.vue
│   ├── tasks/           # Task management pages
│   └── occurrences/     # Occurrence management pages
├── plugins/              # Nuxt plugins
├── prisma/              # Database schema and migrations
├── public/              # Static assets
├── scripts/             # Utility scripts
├── server/              # Backend code
│   ├── api/            # API endpoints
│   ├── services/       # Business logic services
│   └── utils/          # Server utilities
├── stores/              # Pinia stores
├── types/               # TypeScript type definitions
└── utils/               # Shared utilities
```

## Development Guidelines

### Code Style

1. **TypeScript**: Use explicit types, avoid `any`
2. **Vue Components**: Use Composition API with `<script setup>`
3. **Functions**: Arrow function syntax preferred
4. **Imports**: Use `import { type X }` for type imports
5. **Naming**: camelCase for variables/functions, PascalCase for types/components

### API Patterns

```typescript
// Protected route example
export default defineHouseholdProtectedEventHandler(async (event, authUser, householdId) => {
  // Handler implementation
});
```

### Service Layer

Services encapsulate business logic and database operations:

```typescript
const taskService = new TaskService();
const tasks = await taskService.findForHousehold(householdId, filters);
```

### Error Handling

- Use H3's `createError` for API errors
- Include appropriate HTTP status codes
- Log errors with context for debugging
- Handle both expected and unexpected errors

## Key Features

### Task Management
- Create, edit, pause, and soft-delete tasks
- Assign default assignees
- Add instructions and descriptions
- Categorize tasks for organization

### Occurrence Handling
- Automatic generation based on schedules
- Execute (complete) or skip with comments
- Reassign to different household members
- Change due dates
- Comment thread for communication

### Notification System
- Email reminders before due dates
- Event-based notifications (configurable)
- User preference management

### Household Management
- Create or join households with invite codes
- Admin role for user management
- Custom category creation

## Database Schema Highlights

- **Soft Deletes**: Tasks use `metaStatus` field instead of hard deletes
- **JSON Fields**: `scheduleConfig` and `reminderConfig` store complex configurations
- **Audit Trail**: All occurrence changes logged in history
- **Multi-tenancy**: `householdId` ensures data isolation

## Development Setup

1. Install dependencies: `npm install`
2. Configure environment variables (`.env`)
3. Run database migrations: `npx prisma migrate dev`
4. Seed initial data: `npm run db:seed`
5. Generate local SSL certificates (if needed)
6. Start development server: `npm run dev`

## Testing Framework

The project includes a comprehensive testing framework using **Vitest** with **@nuxt/test-utils**:

### Test Structure
```
tests/
├── unit/                    # Unit tests for business logic
│   ├── utils/              # Date calculations, scheduling algorithms
│   └── logic/              # Notification preferences, business rules
├── integration/            # Integration tests for system components
├── fixtures/               # Shared test data and mocks
└── setup.ts               # Global test configuration
```

### Coverage Areas
- **Schedule Logic**: All 6 recurrence patterns, date calculations, edge cases
- **Notification Logic**: User preferences, email templates, reminder timing
- **Integration**: Scheduler endpoints, business rule validation
- **Edge Cases**: Timezone handling, month boundaries, leap years

### Running Tests
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

### Test Philosophy
1. **Unit Tests**: Core business logic (services, utilities, algorithms)
2. **Integration Tests**: API endpoints and service interactions  
3. **E2E Tests**: Critical user workflows (planned)
4. **Type Tests**: TypeScript type validation

The test suite includes 41+ tests ensuring reliability of critical functionality including task scheduling, notification systems, and occurrence management.

## Common Tasks

### Adding a New API Endpoint

1. Create file in `server/api/` following naming convention
2. Use appropriate auth wrapper (`defineProtectedEventHandler` or `defineHouseholdProtectedEventHandler`)
3. Implement business logic in service layer
4. Handle errors appropriately
5. Update types if needed

### Adding a New Page

1. Create Vue file in `pages/` directory
2. Implement authentication check if needed
3. Use Pinia stores for state management
4. Follow existing UI patterns

### Modifying Database Schema

1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name descriptive_name`
3. Update TypeScript types to match
4. Update services and APIs as needed

## Security Considerations

- Google OAuth for authentication
- Bearer token validation on every request
- Household-based data isolation
- Input validation on all API endpoints
- Secure session management

## Performance Considerations

- Efficient database queries with proper indexes
- Minimal data fetching (use includes wisely)
- Client-side state caching with Pinia
- Optimistic UI updates where appropriate

## Future Enhancements

The project documentation mentions several post-MVP features:
- File attachments for tasks
- Rich text support in descriptions
- Granular permissions within households
- Enhanced dashboard with widgets
- Calendar view
- Task dependencies
- Mobile app with push notifications

## Important Notes

- The project uses Google OAuth exclusively (no password-based auth currently)
- CockroachDB is used but treated as PostgreSQL for most purposes
- Email notifications are the only notification method currently
- All times are stored in UTC in the database