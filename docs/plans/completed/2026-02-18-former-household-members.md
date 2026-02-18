# Former Household Members Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a user leaves a household, preserve their identity for historical display, clean up future assignments, and show them as a departed member in the UI.

**Architecture:** New `FormerHouseholdMember` Prisma model stores a name snapshot at departure. `HouseholdService.removeUser()` expanded to upsert the record and clean assignee arrays in a transaction. `/api/household/users` returns both active and former members. Frontend resolves names from both lists, styling departed users with dimmed grey italic text.

**Tech Stack:** Prisma (CockroachDB), Nuxt 3 server routes, Vue 3 Composition API, Tailwind CSS

**Design doc:** `docs/plans/2026-02-18-former-household-members-design.md`

---

### Task 1: Prisma Schema — Add FormerHouseholdMember model

**Files:**
- Modify: `prisma/schema.prisma` (add model after Household)
- Create: migration via `npx prisma migrate dev`

**Step 1: Add the model to schema.prisma**

Add after the Household model (after line 46):

```prisma
// Former Household Member - tracks users who have left a household
model FormerHouseholdMember {
  id          String   @id @default(uuid())
  userId      String
  householdId String
  name        String
  leftAt      DateTime @default(now())

  @@unique([userId, householdId])
  @@map("former_household_members")
}
```

**Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_former_household_members`
Expected: Migration creates `former_household_members` table with columns id, userId, householdId, name, leftAt and a unique index on (userId, householdId).

**Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add FormerHouseholdMember schema for tracking departed users"
```

---

### Task 2: TypeScript Types — Add FormerHouseholdMember type

**Files:**
- Modify: `types/user.ts` (add interface)

**Step 1: Add the FormerHouseholdMember interface**

Add at the end of `types/user.ts`:

```typescript
export interface FormerHouseholdMember {
  userId: string;
  name: string;
  leftAt: Date;
}
```

No `id` or `householdId` — the frontend doesn't need those.

**Step 2: Commit**

```bash
git add types/user.ts
git commit -m "feat: add FormerHouseholdMember type"
```

---

### Task 3: Backend — Expand HouseholdService.removeUser() with transaction

**Files:**
- Modify: `server/services/HouseholdService.ts:113-127` (replace `removeUser` method)

**Step 1: Replace the removeUser method**

The current method (lines 113-127) just nulls householdId. Replace with:

```typescript
async removeUser(userId: string): Promise<void> {
  try {
    // Look up user first to get name and householdId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, householdId: true }
    });

    if (!user || !user.householdId) {
      throw new Error('User not found or not in a household');
    }

    const householdId = user.householdId;

    await prisma.$transaction(async (tx) => {
      // 1. Upsert former member record
      await tx.formerHouseholdMember.upsert({
        where: {
          userId_householdId: { userId, householdId }
        },
        update: {
          name: user.name,
          leftAt: new Date()
        },
        create: {
          userId,
          householdId,
          name: user.name
        }
      });

      // 2. Remove from defaultAssigneeIds on all task definitions in household
      const tasks = await tx.taskDefinition.findMany({
        where: { householdId },
        select: { id: true, defaultAssigneeIds: true }
      });

      for (const task of tasks) {
        if (task.defaultAssigneeIds.includes(userId)) {
          await tx.taskDefinition.update({
            where: { id: task.id },
            data: {
              defaultAssigneeIds: task.defaultAssigneeIds.filter(id => id !== userId)
            }
          });
        }
      }

      // 3. Remove from assigneeIds on future actionable occurrences
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const taskIds = tasks.map(t => t.id);
      if (taskIds.length > 0) {
        const occurrences = await tx.taskOccurrence.findMany({
          where: {
            taskId: { in: taskIds },
            status: { in: ['created', 'assigned'] },
            dueDate: { gte: today }
          },
          select: { id: true, assigneeIds: true }
        });

        for (const occ of occurrences) {
          if (occ.assigneeIds.includes(userId)) {
            await tx.taskOccurrence.update({
              where: { id: occ.id },
              data: {
                assigneeIds: occ.assigneeIds.filter(id => id !== userId)
              }
            });
          }
        }
      }

      // 4. Remove user from household
      await tx.user.update({
        where: { id: userId },
        data: {
          householdId: null,
          isAdmin: false,
          updatedAt: new Date()
        }
      });
    });
  } catch (error) {
    console.error(`[HouseholdService] Unexpected error in removeUser:`, error);
    throw error;
  }
}
```

**Step 2: Verify the app still starts**

Run: `npx nuxi typecheck` (or just start the dev server and hit the endpoint)
Expected: No type errors.

**Step 3: Commit**

```bash
git add server/services/HouseholdService.ts
git commit -m "feat: expand removeUser to create former member record and clean assignments"
```

---

### Task 4: Backend — Update addUser() to clean up former member record

**Files:**
- Modify: `server/services/HouseholdService.ts:94-108` (the `addUser` method)

**Step 1: Add former member cleanup to addUser**

After the existing `prisma.user.update` call (line 102), add:

```typescript
// Remove former member record if rejoining
await prisma.formerHouseholdMember.deleteMany({
  where: { userId, householdId }
});
```

**Step 2: Commit**

```bash
git add server/services/HouseholdService.ts
git commit -m "feat: clean up former member record when user rejoins household"
```

---

### Task 5: Backend — Update /api/household/users to return former members

**Files:**
- Modify: `server/api/household/users.get.ts`

**Step 1: Add HouseholdService method to get former members**

First, add a new method to `server/services/HouseholdService.ts`:

```typescript
/**
 * Get former members of a household
 */
async getFormerMembers(householdId: string) {
  try {
    const formerMembers = await prisma.formerHouseholdMember.findMany({
      where: { householdId },
      orderBy: { leftAt: 'desc' }
    });

    return formerMembers;
  } catch (error) {
    console.error(`[HouseholdService] Unexpected error in getFormerMembers:`, error);
    throw error;
  }
}
```

**Step 2: Update the users.get.ts endpoint**

Replace the full endpoint at `server/api/household/users.get.ts`:

```typescript
import { defineHouseholdProtectedEventHandler } from "@/server/utils/auth";
import { HouseholdService } from "@/server/services/HouseholdService";
import { createError } from "h3";

export default defineHouseholdProtectedEventHandler(
  async (event, authUser, householdId) => {
    try {
      const householdService = new HouseholdService();
      const [users, formerMembers] = await Promise.all([
        householdService.getUsers(householdId),
        householdService.getFormerMembers(householdId),
      ]);

      return {
        members: users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt,
        })),
        formerMembers: formerMembers.map((fm) => ({
          userId: fm.userId,
          name: fm.name,
          leftAt: fm.leftAt,
        })),
      };
    } catch (error) {
      console.error("[API] Error fetching household users:", error);

      if ((error as any).statusCode) {
        throw error;
      }

      throw createError({
        statusCode: 500,
        message: "Server error fetching household users",
        cause: error,
      });
    }
  }
);
```

**Important:** This is a breaking change to the API response shape. Previously it returned a flat array, now it returns `{ members, formerMembers }`. All consumers need to be updated in subsequent tasks.

**Step 3: Commit**

```bash
git add server/services/HouseholdService.ts server/api/household/users.get.ts
git commit -m "feat: return former members alongside active members from users endpoint"
```

---

### Task 6: Frontend — Update all consumers of /api/household/users

This is the largest task. The endpoint response changed from `User[]` to `{ members: User[], formerMembers: FormerHouseholdMember[] }`. Every page that calls this endpoint needs updating.

**Files:**
- Modify: `pages/tasks/index.vue` (~lines 564-566 fetch, ~lines 677-682 getAssigneeNames, template ~lines 270-276)
- Modify: `pages/occurrences/index.vue` (~lines 616-621 fetch, ~lines 709-714 getAssigneeNames, template ~lines 251-256 mobile, ~lines 328-335 desktop)
- Modify: `components/TaskDetails.vue` (~lines 254-267 getDefaultAssigneeNames, template ~line 92)
- Modify: `components/occurrences/OccurrenceTimeline.vue` (~line 25 user name display)
- Modify: `pages/profile/index.vue` (~line 174 fetch for checkCanLeave)
- Modify: `pages/household/index.vue` (fetches household users for member list)

**Step 1: Update pages/tasks/index.vue**

1a. Add FormerHouseholdMember import and ref:

Find the existing `householdUsers` ref and add a `formerMembers` ref alongside it. Import the type from `@/types/user`.

```typescript
import type { FormerHouseholdMember } from '@/types/user';

// ... existing code ...
const formerMembers = ref<FormerHouseholdMember[]>([]);
```

1b. Update the fetch call (~line 564):

Change from:
```typescript
const fetchUsers = api.get<User[]>('/api/household/users')
  .then(data => { householdUsers.value = data; })
```
To:
```typescript
const fetchUsers = api.get<{ members: User[], formerMembers: FormerHouseholdMember[] }>('/api/household/users')
  .then(data => {
    householdUsers.value = data.members;
    formerMembers.value = data.formerMembers;
  })
```

1c. Update getAssigneeNames (~line 677):

Change from returning `string[]` to returning objects:
```typescript
const getAssigneeNames = (assigneeIds: string[]): { name: string; departed: boolean }[] => {
  return assigneeIds.map(id => {
    const active = householdUsers.value.find(u => u.id === id);
    if (active) return { name: active.name, departed: false };

    const former = formerMembers.value.find(u => u.userId === id);
    if (former) return { name: former.name, departed: true };

    return { name: 'Unknown User', departed: false };
  });
};
```

1d. Update template (~line 270):

Change from:
```vue
{{ getAssigneeNames(task.nextOccurrence.assigneeIds).join(', ') }}
```
To:
```vue
<template v-for="(assignee, idx) in getAssigneeNames(task.nextOccurrence.assigneeIds)" :key="idx">
  <span :class="assignee.departed ? 'text-stone-400 italic' : ''">{{ assignee.name }}</span><span v-if="idx < getAssigneeNames(task.nextOccurrence.assigneeIds).length - 1">, </span>
</template>
```

**Step 2: Update pages/occurrences/index.vue**

Same pattern as tasks/index.vue:

2a. Add FormerHouseholdMember import and ref.

2b. Update fetch (~line 616):
```typescript
const data = await api.get<{ members: User[], formerMembers: FormerHouseholdMember[] }>('/api/household/users');
householdUsers.value = data.members;
formerMembers.value = data.formerMembers;
```

2c. Update getAssigneeNames (~line 709) — same function body as tasks page.

2d. Update desktop template (~line 328):
```vue
<div v-if="occurrence.assigneeIds && occurrence.assigneeIds.length > 0" class="text-sm text-stone-900">
  <template v-for="(assignee, idx) in getAssigneeNames(occurrence.assigneeIds)" :key="idx">
    <span :class="assignee.departed ? 'text-stone-400 italic' : ''">{{ assignee.name }}</span><span v-if="idx < getAssigneeNames(occurrence.assigneeIds).length - 1">, </span>
  </template>
</div>
```

2e. Update mobile template (~line 251):
```vue
<template v-if="occurrence.assigneeIds && occurrence.assigneeIds.length > 0">
  <template v-for="(assignee, idx) in getAssigneeNames(occurrence.assigneeIds)" :key="idx">
    <span :class="assignee.departed ? 'text-stone-400 italic' : ''">{{ assignee.name }}</span><span v-if="idx < getAssigneeNames(occurrence.assigneeIds).length - 1">, </span>
  </template>
</template>
```

**Step 3: Update components/TaskDetails.vue**

3a. Add FormerHouseholdMember prop:

Update the Props interface (~line 137):
```typescript
interface Props {
  task: TaskDefinition;
  categories?: Category[];
  householdUsers?: User[];
  formerMembers?: FormerHouseholdMember[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}
```

Update withDefaults:
```typescript
const props = withDefaults(defineProps<Props>(), {
  categories: () => [],
  householdUsers: () => [],
  formerMembers: () => [],
  collapsible: false,
  defaultExpanded: true
});
```

3b. Update getDefaultAssigneeNames (~line 254):

```typescript
const getDefaultAssigneeNames = (assigneeIds: string[] | undefined): { name: string; departed: boolean }[] => {
  if (!assigneeIds || assigneeIds.length === 0) {
    return [];
  }

  return assigneeIds.map(id => {
    const active = props.householdUsers.find(user => user.id === id);
    if (active) return { name: active.name, departed: false };

    const former = props.formerMembers.find(u => u.userId === id);
    if (former) return { name: former.name, departed: true };

    return { name: 'Unknown User', departed: false };
  });
};
```

3c. Update template (~line 91-93):

Change from:
```vue
<p class="text-stone-800">
  {{ getDefaultAssigneeNames(task.defaultAssigneeIds) }}
</p>
```
To:
```vue
<p class="text-stone-800">
  <template v-if="getDefaultAssigneeNames(task.defaultAssigneeIds).length === 0">
    No default assignees
  </template>
  <template v-for="(assignee, idx) in getDefaultAssigneeNames(task.defaultAssigneeIds)" :key="idx">
    <span :class="assignee.departed ? 'text-stone-400 italic' : ''">{{ assignee.name }}</span><span v-if="idx < getDefaultAssigneeNames(task.defaultAssigneeIds).length - 1">, </span>
  </template>
</p>
```

3d. All parents that render `<TaskDetails>` must also pass `:former-members="formerMembers"`. Find these parents and update them.

**Step 4: Update components/occurrences/OccurrenceTimeline.vue**

The timeline gets user data from the backend (`include: { user: true }`). The User record still exists (just unlinked), so `log.user?.name` still works. We need to add departed styling.

4a. Add a `formerMembers` prop:
```typescript
const props = defineProps<{
  occurrenceId: string;
  formerMembers?: FormerHouseholdMember[];
}>();
```

4b. Add a helper to check if user is departed:
```typescript
const isFormerMember = (userId: string): boolean => {
  return (props.formerMembers || []).some(fm => fm.userId === userId);
};
```

4c. Update the user name display (~line 25):

Change from:
```vue
<span class="font-medium text-stone-900">{{ log.user?.name || 'System' }}</span>
```
To:
```vue
<span class="font-medium" :class="log.user && isFormerMember(log.userId) ? 'text-stone-400 italic' : 'text-stone-900'">{{ log.user?.name || 'System' }}</span>
```

4d. Parents that render `<OccurrenceTimeline>` must pass `:former-members="formerMembers"`.

**Step 5: Update pages/profile/index.vue**

The `checkCanLeave` function (~line 174) fetches `/api/household/users` to count admins. Update to use the new response shape:

Change from:
```typescript
const members = await response.json();
const adminCount = members.filter((m: any) => m.isAdmin).length;
const hasOtherMembers = members.length > 1;
```
To:
```typescript
const data = await response.json();
const members = data.members;
const adminCount = members.filter((m: any) => m.isAdmin).length;
const hasOtherMembers = members.length > 1;
```

**Step 6: Update pages/household/index.vue**

This page fetches household users for the member management list. Update to use `data.members` (former members aren't needed on this page since it manages current members).

Find the fetch call and update from:
```typescript
householdUsers.value = data;
```
To:
```typescript
householdUsers.value = data.members;
```

**Step 7: Search for any other consumers**

Run: `grep -r "api/household/users" --include="*.vue" --include="*.ts" pages/ components/ composables/ stores/`

Update any remaining callers found.

**Step 8: Commit**

```bash
git add pages/ components/ types/
git commit -m "feat: display former household members with departed styling throughout UI"
```

---

### Task 7: Verify end-to-end and final commit

**Step 1: Start dev server and test manually**

Run: `npm run dev`

Test scenarios:
1. View tasks page — assignee names display normally for active users
2. View occurrences page — same
3. Switch to a test user and leave household — confirm redirect to /setup-household
4. Switch to an admin in the same household — verify:
   - Tasks previously assigned to departed user now show as "Unassigned" (future ones cleaned up)
   - Completed occurrences still show departed user's name in dimmed/italic style
   - Timeline history shows departed user's name in dimmed/italic style
5. Re-add the departed user to household — verify former member record is cleaned up and they appear as active again

**Step 2: Run type check**

Run: `npx nuxi typecheck`
Expected: No errors.

**Step 3: Run tests**

Run: `npm run test`
Expected: All existing tests pass.

**Step 4: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: address any issues found during testing"
```
