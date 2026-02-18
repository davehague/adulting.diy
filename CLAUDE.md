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
- **Validation**: Zod (schema validation)
- **Dates**: date-fns (date manipulation)

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

## Documentation

Detailed documentation lives in `docs/` and is organized by audience:

- **`docs/functionality/`** - Feature docs from a product perspective (what it does, how users interact)
- **`docs/tech/`** - Technical docs for developers (architecture, algorithms, how to extend)
- **`docs/adrs/`** - Architectural Decision Records
- **`docs/specs/`** - Original project specs (idea, functional spec, blueprint)
- **`docs/brand.md`** - Brand guide (colors, typography, component patterns)
- **`docs/next-up.md`** - Roadmap and future enhancements
- **`docs/plans/`** - Implementation plans (`completed/` subfolder for archived plans)

After completing feature work, use the `update-docs` skill to update relevant documentation.

## Key Concepts

### Data Models

1. **User**: Individual users with Google OAuth authentication
2. **Household**: Groups of users sharing tasks
3. **TaskDefinition**: Templates for tasks with scheduling rules
4. **TaskOccurrence**: Specific instances of tasks that need completion
5. **Category**: Organization system for tasks (predefined + custom)
6. **OccurrenceHistoryLog**: Audit trail for task occurrences

### Task Scheduling System

Tasks support 6 recurrence patterns (once, fixed interval, specific days of week, specific day of month, specific weekday of month, variable interval). See [docs/tech/task-scheduling.md](docs/tech/task-scheduling.md) for details.

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
│   ├── DevUserSwitcher.vue       # Dev login bypass UI
│   ├── DevUserSwitcherDebug.vue  # Dev login debug panel
│   ├── NotificationPreferences.vue
│   ├── TaskDetails.vue
│   ├── occurrences/      # Occurrence-related components
│   │   ├── OccurrenceEditForm.vue
│   │   └── OccurrenceTimeline.vue
│   └── tasks/            # Task-related components
│       ├── TaskCreateForm.vue
│       └── TaskEditForm.vue
├── composables/          # Vue composables
│   └── onClickOutside.ts
├── docs/                 # Project documentation
│   ├── adrs/             # Architectural Decision Records
│   ├── brand.md          # Brand guide (colors, typography, components)
│   ├── functionality/    # Feature docs (product perspective)
│   │   ├── changelog.md
│   │   ├── household-management.md
│   │   ├── notifications-and-reminders.md
│   │   └── task-management.md
│   ├── next-up.md        # Roadmap and future enhancements
│   ├── plans/            # Implementation plans
│   │   └── completed/    # Archived completed plans
│   ├── specs/            # Project specs (idea, functional spec, blueprint)
│   └── tech/             # Technical docs (developer perspective)
│       ├── api-endpoints.md
│       ├── dev-login-bypass.md
│       ├── notification-system.md
│       ├── task-scheduling.md
│       └── testing.md
├── layouts/              # Nuxt layouts
│   ├── default.vue
│   └── landing.vue
├── middleware/           # Route middleware
│   └── auth.global.ts   # Global authentication middleware
├── pages/                # Nuxt pages (file-based routing)
│   ├── index.vue         # Root landing page
│   ├── home.vue
│   ├── login.vue
│   ├── setup-household.vue
│   ├── household/        # Household management
│   ├── profile/          # User profile
│   ├── tasks/            # Task management pages
│   └── occurrences/      # Occurrence management pages
├── plugins/              # Nuxt plugins
│   ├── auth-ready.client.ts
│   └── dev-auth.client.ts  # Dev login bypass plugin
├── prisma/              # Database schema and migrations
├── public/              # Static assets
├── scripts/             # Utility scripts
│   ├── seed.js
│   ├── setup-database.js
│   ├── clear-db.js
│   └── reset-completed-occurrences.js
├── server/              # Backend code
│   ├── api/            # API endpoints
│   ├── services/       # Business logic services
│   │   ├── CategoryService.ts
│   │   ├── HouseholdService.ts
│   │   ├── NotificationService.ts
│   │   ├── OccurrenceService.ts
│   │   ├── TaskService.ts
│   │   └── UserService.ts
│   └── utils/          # Server utilities
│       ├── auth.ts
│       ├── dev-auth.ts
│       ├── prisma/client.ts
│       └── schedule.ts
├── stores/              # Pinia stores
│   ├── auth.ts
│   ├── dev-auth.ts       # Dev login bypass store
│   └── tasks.ts
├── types/               # TypeScript type definitions
│   ├── index.ts
│   ├── category.ts
│   ├── heroicons.d.ts
│   ├── household.ts
│   ├── notification.ts
│   ├── task.ts
│   └── user.ts
└── utils/               # Shared utilities
    └── api.ts
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

See `docs/functionality/` for detailed feature documentation:
- [Task Management](docs/functionality/task-management.md) - Tasks, scheduling, occurrences, lifecycle
- [Notifications and Reminders](docs/functionality/notifications-and-reminders.md) - Events, channels, flexible reminders
- [Household Management](docs/functionality/household-management.md) - Households, roles, categories

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

### Development Login Bypass

The project includes a development-only login bypass system for faster testing:

- **Enable**: Set `DEV_LOGIN_BYPASS=true` in `.env`
- **Usage**: Click the red "🧪 Dev" button in the top-right corner to switch users
- **Security**: Only works when `NODE_ENV=development` and `DEV_LOGIN_BYPASS=true`
- **Implementation**: See [docs/tech/dev-login-bypass.md](docs/tech/dev-login-bypass.md) for details

## Testing

See [docs/tech/testing.md](docs/tech/testing.md) for full details. Quick reference:

```bash
npm run test              # Run all tests (excludes e2e)
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

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

## API Endpoints

See [docs/tech/api-endpoints.md](docs/tech/api-endpoints.md) for the full API reference.

## Architectural Decision Records (ADRs)

Architectural decisions are documented in `docs/adrs/`. Consult these before proposing changes to areas they cover.

- **ADR-0001**: Defer Prisma 7 upgrade (decided 2026-02-18, revisit Q3 2026)

## Important Notes

- The project uses Google OAuth exclusively (no password-based auth currently)
- CockroachDB is used but treated as PostgreSQL for most purposes
- Notifications support email (Mailjet) and Slack (incoming webhooks)
- All times are stored in UTC in the database

## Business Logic Details

For the task-occurrence relationship and scheduling internals, see [docs/tech/task-scheduling.md](docs/tech/task-scheduling.md).

Key concept: **TaskDefinition** (template: what/how/who) generates many **TaskOccurrence** instances (specific: when/status/assignees). The scheduler creates occurrences 3 months ahead based on recurrence rules. See the tech doc for full details on generation, variable recurrence, end conditions, and lifecycle management.
