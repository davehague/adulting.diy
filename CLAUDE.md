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
- **Storage**: Vercel Blob (private store, project photos)

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

This file is a signpost. The detail lives in `docs/`; read the relevant doc before working in an area, and link to it rather than re-explaining it here.

| Doc | Audience | What it covers |
|-----|----------|----------------|
| [docs/functionality/task-management.md](docs/functionality/task-management.md) | Product | Tasks, scheduling patterns, occurrences, lifecycle, catch-up, list filters, the dashboard |
| [docs/functionality/notifications-and-reminders.md](docs/functionality/notifications-and-reminders.md) | Product | Notification events, preferences, channels, reminder rules |
| [docs/functionality/household-management.md](docs/functionality/household-management.md) | Product | Households, roles, invite codes, former members, task categories |
| [docs/functionality/providers.md](docs/functionality/providers.md) | Product | Contractor directory, neighbor evidence, task and project links |
| [docs/functionality/projects.md](docs/functionality/projects.md) | Product | Home projects, photos, steps, linked providers, dashboard next steps |
| [docs/functionality/changelog.md](docs/functionality/changelog.md) | Product | What changed, from the user's point of view |
| [docs/tech/architecture.md](docs/tech/architecture.md) | Developers | System map: directory map, request flow, auth wrappers, data model, pages, integrations, cron |
| [docs/tech/api-endpoints.md](docs/tech/api-endpoints.md) | Developers | Full API reference |
| [docs/tech/task-scheduling.md](docs/tech/task-scheduling.md) | Developers | Recurrence algorithms, occurrence generation, catch-up |
| [docs/tech/notification-system.md](docs/tech/notification-system.md) | Developers | Channel provider pattern, reminder flow, preference logic |
| [docs/tech/provider-ingest.md](docs/tech/provider-ingest.md) | Developers | Provider data model, API keys, machine ingest |
| [docs/tech/testing.md](docs/tech/testing.md) | Developers | Test framework, structure, commands |
| [docs/tech/dev-login-bypass.md](docs/tech/dev-login-bypass.md) | Developers | Development login bypass |
| [docs/adrs/](docs/adrs/) | Developers | Architectural Decision Records |
| [docs/brand.md](docs/brand.md) | Everyone | Colors, typography, component patterns |
| [docs/next-up.md](docs/next-up.md) | Everyone | Roadmap and deferred work |
| `docs/specs/`, `docs/plans/`, `docs/superpowers/` | Reference | Original specs, implementation plans (`docs/plans/completed/` for archived ones), design specs |

`docs/functionality/` is written at capability level with no code; `docs/tech/` is the 30,000-foot technical view. Two skills keep this loop going: run `feature-impact-analysis` against the functionality docs before building a feature, and `update-docs` after completing feature work.

## Key Concepts

### Data Models

1. **User**: Individual users with Google OAuth authentication
2. **Household**: Groups of users sharing tasks
3. **TaskDefinition**: Templates for tasks with scheduling rules
4. **TaskOccurrence**: Specific instances of tasks that need completion
5. **Category**: Organization system for tasks (predefined + custom)
6. **OccurrenceHistoryLog**: Audit trail for task occurrences
7. **FormerHouseholdMember**: Name snapshots of users who left a household
8. **Provider**: Contractors/service providers, with **ProviderCategory**, **ProviderStatus**, **ProviderContact**, **ProviderEvidence** (neighbor sightings), **ProviderComment**, and **TaskProvider** (task link); **ApiKey** is the per-household key for machine ingest. See [docs/functionality/providers.md](docs/functionality/providers.md) and [docs/tech/provider-ingest.md](docs/tech/provider-ingest.md)
9. **Project**: Household home-project tracking (title, location, status, path, notes), with **ProjectPhoto** (private photos in Vercel Blob), **ProjectStep** (a checklist; the dashboard shows each Active project's next undone step) and **ProjectProvider** (a provider linked to the project with its own status: considering, contacted, chosen, passed). See [docs/functionality/projects.md](docs/functionality/projects.md)

### Task Scheduling System

Tasks support 8 recurrence patterns (once, fixed interval, specific days of week, specific day of month, specific weekday of month, variable interval, annual fixed, annual variable). See [docs/tech/task-scheduling.md](docs/tech/task-scheduling.md) for details.

### Authentication Flow

1. Users authenticate via Google OAuth
2. Bearer token sent in Authorization header
3. Server validates token and retrieves user from database
4. Household membership verified for protected routes

## Project Structure

Standard Nuxt 3 layout: `pages/`, `components/`, `layouts/`, `composables/`, `stores/`, `middleware/`, `plugins/`, `utils/` and `types/` on the client; `server/api/` (routes), `server/services/` (business logic) and `server/utils/` (auth wrappers, schemas, scheduling) on the server; `prisma/` for the schema and migrations. See the Directory Map in [docs/tech/architecture.md](docs/tech/architecture.md).

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

`BLOB_READ_WRITE_TOKEN` in `.env` authenticates `server/utils/blob-storage.ts` against the project's private Vercel Blob store (project photos). Local dev and production share the one store, so a local upload is a real upload.

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
