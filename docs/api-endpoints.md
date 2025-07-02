# API Endpoints Reference

This document provides an overview of all API endpoints in the Adulting.DIY application.

## Authentication

The API uses three authentication levels:
- **Public**: No authentication required
- **Protected**: Requires valid bearer token
- **Household**: Requires valid bearer token + household membership

## Categories

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/categories` | Protected | Get all categories (predefined + custom) |
| `POST` | `/api/categories/create` | Protected | Create custom category (admin only) |

## Household Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/household/create` | Protected | Create new household, set user as admin |
| `POST` | `/api/household/join` | Protected | Join household using invite code |
| `GET` | `/api/household/users` | Household | Get all users in household |

## Task Definitions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/tasks` | Household | Get all tasks with optional filtering/search |
| `POST` | `/api/tasks` | Household | Create new task definition |
| `GET` | `/api/tasks/[id]` | Household | Get specific task details |
| `PUT` | `/api/tasks/[id]` | Household | Update task definition |
| `DELETE` | `/api/tasks/[id]` | Household | Soft delete task |
| `POST` | `/api/tasks/[id]/pause` | Household | Pause task (stop generating occurrences) |
| `POST` | `/api/tasks/[id]/unpause` | Household | Resume paused task |
| `GET` | `/api/tasks/[id]/occurrences` | Household | Get all occurrences for specific task |

## Task Occurrences

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/occurrences` | Household | Get all occurrences with filtering/search |
| `GET` | `/api/occurrences/[id]` | Household | Get specific occurrence details |
| `PUT` | `/api/occurrences/[id]` | Household | Update occurrence (due date, assignees) |
| `POST` | `/api/occurrences/[id]/execute` | Household | Mark occurrence as completed |
| `POST` | `/api/occurrences/[id]/skip` | Household | Mark occurrence as skipped with reason |
| `POST` | `/api/occurrences/[id]/comments` | Household | Add comment to occurrence |
| `GET` | `/api/occurrences/[id]/history` | Household | Get occurrence history/timeline |

## User Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/user/profile` | Public | Get user profile by email query |
| `POST` | `/api/user/register` | Public | Register new user from Google OAuth |
| `GET` | `/api/user/notifications` | Household | Get user notification preferences |
| `PUT` | `/api/user/notifications` | Household | Update notification preferences |

## System Scheduler

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/scheduler/run` | Public⚠️ | Generate task occurrences (automated) |
| `POST` | `/api/scheduler/reminders` | Public⚠️ | Send reminder notifications (automated) |

⚠️ *These endpoints should be secured for production use*

## Request/Response Patterns

### Filtering & Search
Many GET endpoints support query parameters:
- `status` - Filter by status
- `category` - Filter by category
- `assignee` - Filter by assignee
- `search` - Text search
- `startDate`/`endDate` - Date range filtering
- `sortBy`/`sortOrder` - Sorting options

### Error Responses
All endpoints return standardized error responses:
```json
{
  "statusCode": 400,
  "statusMessage": "Bad Request",
  "message": "Detailed error description"
}
```

### Authentication Headers
Protected endpoints require:
```
Authorization: Bearer <token>
```

## Data Models

Key data models handled by the API:
- **User**: Profile and authentication data
- **Household**: Group container for users and tasks
- **Category**: Task organization (predefined + custom)
- **TaskDefinition**: Task templates with scheduling rules
- **TaskOccurrence**: Specific instances of tasks to be completed
- **OccurrenceHistoryLog**: Audit trail for occurrence changes

## Rate Limiting

No rate limiting is currently implemented. Consider adding rate limiting for production deployment, especially for:
- User registration endpoints
- Scheduler endpoints
- Comment creation