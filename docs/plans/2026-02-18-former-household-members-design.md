# Former Household Members — Design

## Problem

When a user leaves a household, their `householdId` is set to null. This severs the link to the household, causing:
- Assignee names show as "Unknown User" everywhere
- History log authors show as "System"
- No indication the person ever existed in the household
- Departed users remain as phantom assignees on future tasks/occurrences

## Solution

### Schema: New `FormerHouseholdMember` table

```prisma
model FormerHouseholdMember {
  id          String   @id @default(uuid())
  userId      String
  householdId String
  name        String   // snapshot at departure time
  leftAt      DateTime @default(now())

  @@unique([userId, householdId])
  @@map("former_household_members")
}
```

Lightweight audit record. Name is snapshotted at departure so it's always available. Unique constraint on `[userId, householdId]` — upsert on re-departure. No foreign keys intentionally.

### Backend: `HouseholdService.removeUser()` expanded

When a user is removed (voluntary leave or admin kick), in a single transaction:

1. Look up the user to get name and householdId
2. Upsert a `FormerHouseholdMember` record
3. Remove user's ID from `TaskDefinition.defaultAssigneeIds` for all tasks in that household
4. Remove user's ID from `TaskOccurrence.assigneeIds` for actionable occurrences (status `created` or `assigned`, due date >= today)
5. Null the `householdId` and set `isAdmin = false` (existing behavior)

### Backend: `HouseholdService.addUser()` addition

If a `FormerHouseholdMember` record exists for this user+household, delete it (they're back).

### API: `/api/household/users` response change

Always returns both lists:

```json
{
  "members": [{ "id": "...", "name": "Jane", "status": "active", ... }],
  "formerMembers": [{ "userId": "...", "name": "Jane", "leftAt": "...", "status": "departed" }]
}
```

### Frontend: Name resolution

`getAssigneeNames` (in tasks/index, occurrences/index, TaskDetails) returns objects instead of strings:

```typescript
{ name: string, departed: boolean }
```

Check active members first, then former members, then fall back to "Unknown User".

### Frontend: Display styling

Departed users rendered with dimmed grey italic text (`text-stone-400 italic`). Active users render normally.

### Frontend: OccurrenceTimeline

Pass former members list so timeline can apply dimmed styling to actions by departed users. Keep "System" fallback for truly system-generated events.

### Frontend: Filter dropdowns

Assignee filter dropdowns only populated from active members. Former members excluded.

### Assignment cleanup behavior

| Data | Action on departure |
|------|-------------------|
| `TaskDefinition.defaultAssigneeIds` | Remove departed user's ID |
| `TaskOccurrence.assigneeIds` (future, actionable) | Remove departed user's ID |
| `TaskOccurrence.assigneeIds` (past/completed) | Leave untouched |
| `OccurrenceHistoryLog` | Leave untouched |
| `TaskHistoryLog` | Leave untouched |

Admins can find newly unassigned tasks/occurrences using existing sort/filter by unassigned.

### Edge cases

- **Rejoin same household**: `addUser` deletes the former member record
- **Join different household**: No conflict, former record scoped to original household
- **Admin removes user**: Same removeUser path as voluntary leave
- **Last member leaves**: Former member record still created, household sits empty
