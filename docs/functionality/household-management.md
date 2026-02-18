# Household Management

## Overview

A household is the shared space where members collaborate on tasks. All task data is isolated per household, ensuring multi-tenancy.

## Creating a Household

Any authenticated user without a household can create one:
- Provide a **name** and optional **timezone** (defaults to UTC)
- The creator automatically becomes an **admin**
- An 8-character **invite code** (alphanumeric, e.g. `A3BX9K2M`) is generated for sharing

## Joining a Household

Users join by entering the household's invite code. New members join with **member** role (not admin). A user can only belong to one household at a time.

## Leaving a Household

Any member can leave from the **Profile** page, with one constraint: the **last admin cannot leave** if other members are still present. The admin must either promote another member to admin first or remove all other members.

When a user leaves (or is removed by an admin):
- A **former member record** is created, snapshotting the user's name at departure time
- The user is **removed from default assignees** on all task definitions in the household
- The user is **removed from assignees** on all future actionable occurrences (status `created` or `assigned`, due date today or later)
- Past and completed occurrences are **left untouched** for historical accuracy
- The user's name appears with **dimmed grey italic styling** wherever it was referenced historically

If a user rejoins the same household, the former member record is deleted and they become a normal active member again.

## Former Members

Departed members remain visible in the household's historical data. Their names appear in:
- Assignee lists on past/completed occurrences
- Occurrence timeline history (comments, status changes, etc.)
- Task detail default assignees (if they were assigned before cleanup)

Former members are styled with dimmed/italic text to distinguish them from active members. They do not appear in assignee filter dropdowns or assignment pickers.

## Roles

The household uses a two-tier role system:

| Capability | Admin | Member |
|-----------|-------|--------|
| View household details and members | Yes | Yes |
| Create and manage tasks | Yes | Yes |
| Complete/skip/comment on occurrences | Yes | Yes |
| Update household settings (name, timezone) | Yes | No |
| Remove members | Yes | No |
| Promote/demote admins | Yes | No |
| Create custom categories | Yes | No |
| Regenerate invite code | Yes | No |

## Timezone

Each household has a timezone setting (IANA format, e.g. `America/New_York`). This is used for:
- Determining "today" for reminder scheduling
- Daily boundary calculations for deduplication
- Display formatting on the client

All dates are stored in UTC in the database; the household timezone is applied at the presentation and scheduling layers.

## Categories

Tasks are organized using categories. The system provides two tiers:

### Default Categories
- System-wide, shared across all households
- Cannot be modified or deleted
- Always available

### Custom Categories
- Created by household admins
- Private to the household
- Category names must be unique within a household
- Cannot be deleted while tasks reference them (reassign tasks first)

## Invite Codes

- 8-character alphanumeric codes (A-Z, 0-9)
- Case-sensitive
- Admins can regenerate the invite code at any time (the old code becomes invalid immediately)
- Useful if a code is shared too broadly or compromised
