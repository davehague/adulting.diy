# Filter Bar Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the bulky filter/search bars on `/tasks` and `/occurrences` pages with compact, brand-aligned toolbars and add sortable table headers.

**Architecture:** Tests first for service-layer filtering logic (TDD), then UI changes. Both pages get a single-row compact toolbar replacing the current card-style filter panel. Sorting moves from a dropdown to clickable table headers. A shared composable handles sort state.

**Tech Stack:** Vitest (unit tests), Vue 3 Composition API, Tailwind CSS, Lucide Vue Next icons

---

## Task 1: Write tests for TaskService.findForHousehold filtering

**Files:**
- Create: `tests/unit/services/task-service-filters.test.ts`

**Step 1: Write the test file**

This tests that the Prisma `where` clause is built correctly for every filter combination. We mock Prisma and assert on what `findMany` was called with.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    taskDefinition: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { TaskService } from '@/server/services/TaskService'

const mockedPrisma = prisma as unknown as {
  taskDefinition: {
    findMany: ReturnType<typeof vi.fn>
  }
}

describe('TaskService.findForHousehold filters', () => {
  let service: TaskService
  const householdId = 'household-123'

  beforeEach(() => {
    service = new TaskService()
    vi.clearAllMocks()
    mockedPrisma.taskDefinition.findMany.mockResolvedValue([])
  })

  it('excludes soft-deleted tasks by default (no filters)', async () => {
    await service.findForHousehold(householdId)

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          metaStatus: { not: 'soft-deleted' },
        }),
      })
    )
  })

  it('filters by status when provided', async () => {
    await service.findForHousehold(householdId, { status: 'active' })

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          metaStatus: 'active',
        }),
      })
    )
  })

  it('allows filtering for soft-deleted tasks explicitly', async () => {
    await service.findForHousehold(householdId, { status: 'soft-deleted' })

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          metaStatus: 'soft-deleted',
        }),
      })
    )
  })

  it('filters by categoryId when provided', async () => {
    await service.findForHousehold(householdId, { categoryId: 'cat-123' })

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          categoryId: 'cat-123',
        }),
      })
    )
  })

  it('filters by search term on name and description', async () => {
    await service.findForHousehold(householdId, { search: 'vacuum' })

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          householdId,
          OR: [
            { name: { contains: 'vacuum', mode: 'insensitive' } },
            { description: { contains: 'vacuum', mode: 'insensitive' } },
          ],
        }),
      })
    )
  })

  it('combines status + categoryId filters', async () => {
    await service.findForHousehold(householdId, {
      status: 'active',
      categoryId: 'cat-123',
    })

    const call = mockedPrisma.taskDefinition.findMany.mock.calls[0][0]
    expect(call.where.householdId).toBe(householdId)
    expect(call.where.metaStatus).toBe('active')
    expect(call.where.categoryId).toBe('cat-123')
  })

  it('combines status + search filters', async () => {
    await service.findForHousehold(householdId, {
      status: 'paused',
      search: 'clean',
    })

    const call = mockedPrisma.taskDefinition.findMany.mock.calls[0][0]
    expect(call.where.metaStatus).toBe('paused')
    expect(call.where.OR).toEqual([
      { name: { contains: 'clean', mode: 'insensitive' } },
      { description: { contains: 'clean', mode: 'insensitive' } },
    ])
  })

  it('combines categoryId + search filters', async () => {
    await service.findForHousehold(householdId, {
      categoryId: 'cat-123',
      search: 'mop',
    })

    const call = mockedPrisma.taskDefinition.findMany.mock.calls[0][0]
    expect(call.where.categoryId).toBe('cat-123')
    expect(call.where.OR).toEqual([
      { name: { contains: 'mop', mode: 'insensitive' } },
      { description: { contains: 'mop', mode: 'insensitive' } },
    ])
    // Should still exclude soft-deleted since no status filter
    expect(call.where.metaStatus).toEqual({ not: 'soft-deleted' })
  })

  it('combines all three filters', async () => {
    await service.findForHousehold(householdId, {
      status: 'active',
      categoryId: 'cat-123',
      search: 'kitchen',
    })

    const call = mockedPrisma.taskDefinition.findMany.mock.calls[0][0]
    expect(call.where.householdId).toBe(householdId)
    expect(call.where.metaStatus).toBe('active')
    expect(call.where.categoryId).toBe('cat-123')
    expect(call.where.OR).toEqual([
      { name: { contains: 'kitchen', mode: 'insensitive' } },
      { description: { contains: 'kitchen', mode: 'insensitive' } },
    ])
  })

  it('includes next pending occurrence in results', async () => {
    await service.findForHousehold(householdId)

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          category: true,
          occurrences: expect.objectContaining({
            where: { status: { in: ['created', 'assigned'] } },
            orderBy: { dueDate: 'asc' },
            take: 1,
          }),
        }),
      })
    )
  })

  it('orders results by name ascending', async () => {
    await service.findForHousehold(householdId)

    expect(mockedPrisma.taskDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: 'asc' },
      })
    )
  })
})
```

**Step 2: Run the tests to verify they pass**

Run: `npm run test -- tests/unit/services/task-service-filters.test.ts`
Expected: All tests PASS (we're testing existing behavior)

**Step 3: Commit**

```
git add tests/unit/services/task-service-filters.test.ts
git commit -m "test: add unit tests for TaskService filter combinations"
```

---

## Task 2: Write tests for OccurrenceService.findForHousehold filtering

**Files:**
- Create: `tests/unit/services/occurrence-service-filters.test.ts`

**Step 1: Write the test file**

More complex — tests status, statusIn, categoryId, assigneeId, date range, search, and combinations.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/server/utils/prisma/client', () => ({
  default: {
    taskOccurrence: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

import prisma from '@/server/utils/prisma/client'
import { OccurrenceService } from '@/server/services/OccurrenceService'

const mockedPrisma = prisma as unknown as {
  taskOccurrence: {
    findMany: ReturnType<typeof vi.fn>
  }
}

describe('OccurrenceService.findForHousehold filters', () => {
  let service: OccurrenceService
  const householdId = 'household-123'

  beforeEach(() => {
    service = new OccurrenceService()
    vi.clearAllMocks()
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([])
  })

  it('filters by household and excludes soft-deleted tasks (no filters)', async () => {
    await service.findForHousehold(householdId)

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          task: expect.objectContaining({
            householdId,
            metaStatus: { not: 'soft-deleted' },
          }),
        }),
      })
    )
  })

  it('filters by single status', async () => {
    await service.findForHousehold(householdId, { status: 'completed' })

    const call = mockedPrisma.taskOccurrence.findMany.mock.calls[0][0]
    expect(call.where.status).toBe('completed')
  })

  it('filters by multiple statuses via statusIn', async () => {
    await service.findForHousehold(householdId, { statusIn: 'created,assigned' })

    const call = mockedPrisma.taskOccurrence.findMany.mock.calls[0][0]
    expect(call.where.status).toEqual({ in: ['created', 'assigned'] })
  })

  it('prefers status over statusIn when both provided', async () => {
    await service.findForHousehold(householdId, {
      status: 'completed',
      statusIn: 'created,assigned',
    })

    const call = mockedPrisma.taskOccurrence.findMany.mock.calls[0][0]
    // status takes precedence (the if/else if structure)
    expect(call.where.status).toBe('completed')
  })

  it('filters by categoryId on the task relation', async () => {
    await service.findForHousehold(householdId, { categoryId: 'cat-123' })

    const call = mockedPrisma.taskOccurrence.findMany.mock.calls[0][0]
    expect(call.where.task.categoryId).toBe('cat-123')
  })

  it('filters by assigneeId using has operator', async () => {
    await service.findForHousehold(householdId, { assigneeId: 'user-123' })

    const call = mockedPrisma.taskOccurrence.findMany.mock.calls[0][0]
    expect(call.where.assigneeIds).toEqual({ has: 'user-123' })
  })

  it('filters by dueDateFrom only', async () => {
    const fromDate = new Date('2024-03-01')
    await service.findForHousehold(householdId, { dueDateFrom: fromDate })

    const call = mockedPrisma.taskOccurrence.findMany.mock.calls[0][0]
    expect(call.where.dueDate).toEqual({ gte: fromDate })
  })

  it('filters by dueDateTo only', async () => {
    const toDate = new Date('2024-03-31')
    await service.findForHousehold(householdId, { dueDateTo: toDate })

    const call = mockedPrisma.taskOccurrence.findMany.mock.calls[0][0]
    expect(call.where.dueDate).toEqual({ lte: toDate })
  })

  it('filters by full date range (from + to)', async () => {
    const fromDate = new Date('2024-03-01')
    const toDate = new Date('2024-03-31')
    await service.findForHousehold(householdId, {
      dueDateFrom: fromDate,
      dueDateTo: toDate,
    })

    const call = mockedPrisma.taskOccurrence.findMany.mock.calls[0][0]
    expect(call.where.dueDate).toEqual({ gte: fromDate, lte: toDate })
  })

  it('filters by search term on task name (client-side)', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([
      { id: '1', task: { name: 'Clean kitchen', description: null } },
      { id: '2', task: { name: 'Mow lawn', description: null } },
      { id: '3', task: { name: 'Vacuum', description: 'Clean the floors' } },
    ])

    const results = await service.findForHousehold(householdId, { search: 'clean' })

    // Should match task 1 (name) and task 3 (description)
    expect(results).toHaveLength(2)
    expect(results.map((r: any) => r.id)).toEqual(['1', '3'])
  })

  it('search is case-insensitive', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([
      { id: '1', task: { name: 'VACUUM Floors', description: null } },
    ])

    const results = await service.findForHousehold(householdId, { search: 'vacuum' })

    expect(results).toHaveLength(1)
  })

  it('combines status + categoryId + assigneeId', async () => {
    await service.findForHousehold(householdId, {
      status: 'assigned',
      categoryId: 'cat-123',
      assigneeId: 'user-456',
    })

    const call = mockedPrisma.taskOccurrence.findMany.mock.calls[0][0]
    expect(call.where.status).toBe('assigned')
    expect(call.where.task.categoryId).toBe('cat-123')
    expect(call.where.assigneeIds).toEqual({ has: 'user-456' })
  })

  it('combines statusIn + date range + search', async () => {
    const fromDate = new Date('2024-03-01')
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([
      { id: '1', task: { name: 'Clean kitchen', description: null } },
    ])

    const results = await service.findForHousehold(householdId, {
      statusIn: 'created,assigned',
      dueDateFrom: fromDate,
      search: 'clean',
    })

    // Check DB filters were applied
    const call = mockedPrisma.taskOccurrence.findMany.mock.calls[0][0]
    expect(call.where.status).toEqual({ in: ['created', 'assigned'] })
    expect(call.where.dueDate).toEqual({ gte: fromDate })

    // Search is client-side, so check filtered results
    expect(results).toHaveLength(1)
  })

  it('combines all filters together', async () => {
    const fromDate = new Date('2024-03-01')
    const toDate = new Date('2024-03-31')
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([
      { id: '1', task: { name: 'Clean kitchen', description: null } },
    ])

    const results = await service.findForHousehold(householdId, {
      status: 'assigned',
      categoryId: 'cat-123',
      assigneeId: 'user-456',
      dueDateFrom: fromDate,
      dueDateTo: toDate,
      search: 'clean',
    })

    const call = mockedPrisma.taskOccurrence.findMany.mock.calls[0][0]
    // DB-level filters
    expect(call.where.status).toBe('assigned')
    expect(call.where.task.categoryId).toBe('cat-123')
    expect(call.where.task.householdId).toBe(householdId)
    expect(call.where.assigneeIds).toEqual({ has: 'user-456' })
    expect(call.where.dueDate).toEqual({ gte: fromDate, lte: toDate })

    // Client-side search
    expect(results).toHaveLength(1)
  })

  it('returns empty results when search matches nothing', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([
      { id: '1', task: { name: 'Clean kitchen', description: null } },
    ])

    const results = await service.findForHousehold(householdId, { search: 'zzz_no_match' })

    expect(results).toHaveLength(0)
  })

  it('skips search filter for empty/whitespace-only search string', async () => {
    mockedPrisma.taskOccurrence.findMany.mockResolvedValue([
      { id: '1', task: { name: 'Clean', description: null } },
      { id: '2', task: { name: 'Mow', description: null } },
    ])

    const results = await service.findForHousehold(householdId, { search: '   ' })

    // Whitespace-only search should return all results (not filter)
    expect(results).toHaveLength(2)
  })

  it('includes task with category in results', async () => {
    await service.findForHousehold(householdId)

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          task: expect.objectContaining({
            include: { category: true },
          }),
        }),
      })
    )
  })

  it('orders results by dueDate ascending', async () => {
    await service.findForHousehold(householdId)

    expect(mockedPrisma.taskOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { dueDate: 'asc' },
      })
    )
  })
})
```

**Step 2: Run the tests to verify they pass**

Run: `npm run test -- tests/unit/services/occurrence-service-filters.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```
git add tests/unit/services/occurrence-service-filters.test.ts
git commit -m "test: add unit tests for OccurrenceService filter combinations"
```

---

## Task 3: Redesign filter bar on /tasks page

**Files:**
- Modify: `pages/tasks/index.vue` (lines 10-46 template, lines 306-307 imports)

**Step 1: Add Lucide icon imports**

In the `<script setup>` section, update the import from lucide-vue-next:

```typescript
import { Plus, Search, X, ChevronUp, ChevronDown } from 'lucide-vue-next';
```

**Step 2: Add sort state**

Add after the `filters` reactive block (around line 337):

```typescript
// Sort state
const sortColumn = ref<string>('name');
const sortDirection = ref<'asc' | 'desc'>('asc');

const toggleSort = (column: string) => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortDirection.value = 'asc';
  }
};
```

**Step 3: Update the `tasks` computed to sort client-side**

Replace the existing `tasks` computed (lines 317-322):

```typescript
const tasks = computed(() => {
  let list = taskStore.tasks;

  // Client-side overdue filter
  if (filters.status === 'overdue') {
    list = list.filter(task => task.nextOccurrence && isOverdue(task.nextOccurrence.dueDate));
  }

  // Client-side sorting
  const sorted = [...list];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortColumn.value) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'category':
        cmp = getCategoryName(a.categoryId).localeCompare(getCategoryName(b.categoryId));
        break;
      case 'nextDue': {
        const aDate = a.nextOccurrence ? new Date(a.nextOccurrence.dueDate).getTime() : Infinity;
        const bDate = b.nextOccurrence ? new Date(b.nextOccurrence.dueDate).getTime() : Infinity;
        cmp = aDate - bDate;
        break;
      }
      case 'status':
        cmp = a.metaStatus.localeCompare(b.metaStatus);
        break;
      default:
        cmp = 0;
    }
    return sortDirection.value === 'desc' ? -cmp : cmp;
  });

  return sorted;
});
```

**Step 4: Add active filter count and clear helper**

```typescript
const activeFilterCount = computed(() => {
  let count = 0;
  if (filters.status) count++;
  if (filters.categoryId) count++;
  if (filters.search) count++;
  return count;
});

const clearFilters = () => {
  filters.status = '';
  filters.categoryId = '';
  filters.search = '';
};

const clearFilter = (key: 'status' | 'categoryId' | 'search') => {
  filters[key] = '';
};
```

**Step 5: Replace filter bar template (lines 10-46)**

Replace the `<!-- Filters and Search -->` section with:

```html
    <!-- Filters and Search -->
    <div class="flex flex-col gap-2 mb-6">
      <!-- Compact toolbar row -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- Search input with icon -->
        <div class="relative flex-1 min-w-[200px] max-w-sm">
          <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            v-model="filters.search"
            type="text"
            placeholder="Search tasks..."
            class="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-700 placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors"
          />
        </div>

        <!-- Status select -->
        <select
          v-model="filters.status"
          class="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors min-w-[140px]"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="overdue">Overdue</option>
          <option value="paused">Paused</option>
          <option value="soft-deleted">Deleted</option>
          <option value="completed">Completed</option>
        </select>

        <!-- Category select -->
        <select
          v-model="filters.categoryId"
          class="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors min-w-[150px]"
        >
          <option value="">All Categories</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
      </div>

      <!-- Active filter chips -->
      <div v-if="activeFilterCount > 0" class="flex items-center gap-2 flex-wrap">
        <span
          v-if="filters.status"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          Status: {{ filters.status.charAt(0).toUpperCase() + filters.status.slice(1) }}
          <button @click="clearFilter('status')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <span
          v-if="filters.categoryId"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          {{ getCategoryName(filters.categoryId) }}
          <button @click="clearFilter('categoryId')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <span
          v-if="filters.search"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          Search: "{{ filters.search }}"
          <button @click="clearFilter('search')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <button
          @click="clearFilters"
          class="text-xs text-stone-500 hover:text-stone-700 transition-colors"
        >
          Clear all
        </button>
      </div>
    </div>
```

**Step 6: Update table headers to be sortable (desktop table)**

Replace the `<thead>` section with sortable headers. Each `<th>` gets a click handler and sort indicator:

```html
        <thead class="bg-stone-50">
          <tr>
            <th scope="col" @click="toggleSort('name')"
              class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 transition-colors select-none">
              <span class="inline-flex items-center gap-1">
                Task
                <ChevronUp v-if="sortColumn === 'name' && sortDirection === 'asc'" :size="14" class="text-amber-600" />
                <ChevronDown v-else-if="sortColumn === 'name' && sortDirection === 'desc'" :size="14" class="text-amber-600" />
              </span>
            </th>
            <th scope="col" @click="toggleSort('category')"
              class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 transition-colors select-none">
              <span class="inline-flex items-center gap-1">
                Category
                <ChevronUp v-if="sortColumn === 'category' && sortDirection === 'asc'" :size="14" class="text-amber-600" />
                <ChevronDown v-else-if="sortColumn === 'category' && sortDirection === 'desc'" :size="14" class="text-amber-600" />
              </span>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Schedule
            </th>
            <th scope="col" @click="toggleSort('nextDue')"
              class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 transition-colors select-none">
              <span class="inline-flex items-center gap-1">
                Next Due
                <ChevronUp v-if="sortColumn === 'nextDue' && sortDirection === 'asc'" :size="14" class="text-amber-600" />
                <ChevronDown v-else-if="sortColumn === 'nextDue' && sortDirection === 'desc'" :size="14" class="text-amber-600" />
              </span>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Assignee(s)
            </th>
            <th scope="col" @click="toggleSort('status')"
              class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 transition-colors select-none">
              <span class="inline-flex items-center gap-1">
                Status
                <ChevronUp v-if="sortColumn === 'status' && sortDirection === 'asc'" :size="14" class="text-amber-600" />
                <ChevronDown v-else-if="sortColumn === 'status' && sortDirection === 'desc'" :size="14" class="text-amber-600" />
              </span>
            </th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
```

**Step 7: Run dev server and visually verify**

Run: `npm run dev`
Verify: Navigate to `/tasks`, confirm compact toolbar, filter chips, and sortable headers work.

**Step 8: Commit**

```
git add pages/tasks/index.vue
git commit -m "feat: redesign tasks page filter bar with compact toolbar and sortable headers"
```

---

## Task 4: Redesign filter bar on /occurrences page

**Files:**
- Modify: `pages/occurrences/index.vue` (lines 10-84 template, imports, script)

**Step 1: Add Lucide icon imports and sort state**

Update imports:

```typescript
import { Plus, Search, X, ChevronUp, ChevronDown, SlidersHorizontal } from 'lucide-vue-next';
```

Replace the `sortBy` ref with sortable column state:

```typescript
// Sort state (replaces sortBy dropdown)
const sortColumn = ref<string>('dueDate');
const sortDirection = ref<'asc' | 'desc'>('asc');

const toggleSort = (column: string) => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortDirection.value = 'asc';
  }
};
```

Add date filter toggle and helpers:

```typescript
// Date filter panel toggle
const showDateFilters = ref(false);

const activeFilterCount = computed(() => {
  let count = 0;
  if (filters.status && filters.status !== 'pending') count++; // pending is default
  if (filters.categoryId) count++;
  if (filters.assigneeId) count++;
  if (filters.search) count++;
  if (filters.dueDateFrom) count++;
  if (filters.dueDateTo) count++;
  return count;
});

const clearFilters = () => {
  filters.status = 'pending';
  filters.categoryId = '';
  filters.assigneeId = '';
  filters.search = '';
  filters.dueDateFrom = '';
  filters.dueDateTo = '';
  showDateFilters.value = false;
};

const clearFilter = (key: keyof typeof filters) => {
  if (key === 'status') {
    filters.status = 'pending'; // Reset to default, not empty
  } else {
    filters[key] = '';
  }
};
```

**Step 2: Update occurrences computed to use sortable columns**

Replace the existing `occurrences` computed:

```typescript
const occurrences = computed(() => {
  const sorted = [...rawOccurrences.value];

  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortColumn.value) {
      case 'dueDate':
        cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        break;
      case 'taskName':
        cmp = (a.task?.name || '').localeCompare(b.task?.name || '');
        break;
      case 'category':
        cmp = getCategoryName(a.task?.category).localeCompare(getCategoryName(b.task?.category));
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      default:
        break;
    }
    return sortDirection.value === 'desc' ? -cmp : cmp;
  });

  return sorted;
});
```

**Step 3: Replace filter bar template (lines 10-84)**

Replace the `<!-- Filters and Search -->` section:

```html
    <!-- Filters and Search -->
    <div class="flex flex-col gap-2 mb-6">
      <!-- Compact toolbar row -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- Search input with icon -->
        <div class="relative flex-1 min-w-[200px] max-w-sm">
          <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            v-model="filters.search"
            type="text"
            placeholder="Search tasks..."
            class="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-700 placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors"
          />
        </div>

        <!-- Status select -->
        <select
          v-model="filters.status"
          class="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors min-w-[140px]"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending (Created/Assigned)</option>
          <option value="created">Created</option>
          <option value="assigned">Assigned</option>
          <option value="completed">Completed</option>
          <option value="skipped">Skipped</option>
        </select>

        <!-- Category select -->
        <select
          v-model="filters.categoryId"
          class="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors min-w-[150px]"
        >
          <option value="">All Categories</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>

        <!-- Assignee select -->
        <select
          v-model="filters.assigneeId"
          class="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors min-w-[140px]"
        >
          <option value="">All Assignees</option>
          <option v-for="user in householdUsers" :key="user.id" :value="user.id">
            {{ user.name }}
          </option>
        </select>

        <!-- Date filter toggle button -->
        <button
          @click="showDateFilters = !showDateFilters"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors"
          :class="showDateFilters || filters.dueDateFrom || filters.dueDateTo
            ? 'bg-amber-50 border-amber-300 text-amber-700'
            : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'"
        >
          <SlidersHorizontal :size="16" />
          <span class="hidden sm:inline">Dates</span>
        </button>
      </div>

      <!-- Date range row (collapsible) -->
      <div v-if="showDateFilters" class="flex flex-wrap items-center gap-2">
        <div class="relative">
          <input
            v-model="filters.dueDateFrom"
            type="date"
            class="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors"
            placeholder="From"
          />
        </div>
        <span class="text-stone-400 text-sm">to</span>
        <div class="relative">
          <input
            v-model="filters.dueDateTo"
            type="date"
            class="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors"
          />
        </div>
      </div>

      <!-- Active filter chips -->
      <div v-if="activeFilterCount > 0" class="flex items-center gap-2 flex-wrap">
        <span
          v-if="filters.status && filters.status !== 'pending'"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          Status: {{ filters.status.charAt(0).toUpperCase() + filters.status.slice(1) }}
          <button @click="clearFilter('status')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <span
          v-if="filters.categoryId"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          {{ getCategoryName(categories.find(c => c.id === filters.categoryId)?.name ? { name: categories.find(c => c.id === filters.categoryId)?.name } : undefined) }}
          <button @click="clearFilter('categoryId')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <span
          v-if="filters.assigneeId"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          {{ householdUsers.find(u => u.id === filters.assigneeId)?.name || 'Assignee' }}
          <button @click="clearFilter('assigneeId')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <span
          v-if="filters.search"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          Search: "{{ filters.search }}"
          <button @click="clearFilter('search')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <span
          v-if="filters.dueDateFrom"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          From: {{ filters.dueDateFrom }}
          <button @click="clearFilter('dueDateFrom')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <span
          v-if="filters.dueDateTo"
          class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          To: {{ filters.dueDateTo }}
          <button @click="clearFilter('dueDateTo')" class="hover:text-amber-900"><X :size="12" /></button>
        </span>
        <button
          @click="clearFilters"
          class="text-xs text-stone-500 hover:text-stone-700 transition-colors"
        >
          Clear all
        </button>
      </div>
    </div>
```

**Step 4: Update table headers to be sortable**

Replace the `<thead>` block:

```html
          <thead class="bg-stone-50">
            <tr>
              <th scope="col" @click="toggleSort('taskName')"
                class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 transition-colors select-none">
                <span class="inline-flex items-center gap-1">
                  Task
                  <ChevronUp v-if="sortColumn === 'taskName' && sortDirection === 'asc'" :size="14" class="text-amber-600" />
                  <ChevronDown v-else-if="sortColumn === 'taskName' && sortDirection === 'desc'" :size="14" class="text-amber-600" />
                </span>
              </th>
              <th scope="col" @click="toggleSort('category')"
                class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 transition-colors select-none">
                <span class="inline-flex items-center gap-1">
                  Category
                  <ChevronUp v-if="sortColumn === 'category' && sortDirection === 'asc'" :size="14" class="text-amber-600" />
                  <ChevronDown v-else-if="sortColumn === 'category' && sortDirection === 'desc'" :size="14" class="text-amber-600" />
                </span>
              </th>
              <th scope="col" @click="toggleSort('dueDate')"
                class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 transition-colors select-none">
                <span class="inline-flex items-center gap-1">
                  Due Date
                  <ChevronUp v-if="sortColumn === 'dueDate' && sortDirection === 'asc'" :size="14" class="text-amber-600" />
                  <ChevronDown v-else-if="sortColumn === 'dueDate' && sortDirection === 'desc'" :size="14" class="text-amber-600" />
                </span>
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Assignee(s)
              </th>
              <th scope="col" @click="toggleSort('status')"
                class="px-6 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-700 transition-colors select-none">
                <span class="inline-flex items-center gap-1">
                  Status
                  <ChevronUp v-if="sortColumn === 'status' && sortDirection === 'asc'" :size="14" class="text-amber-600" />
                  <ChevronDown v-else-if="sortColumn === 'status' && sortDirection === 'desc'" :size="14" class="text-amber-600" />
                </span>
              </th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
```

**Step 5: Run dev server and visually verify**

Run: `npm run dev`
Verify: Navigate to `/occurrences`, confirm compact toolbar, date filter toggle, filter chips, and sortable headers work.

**Step 6: Commit**

```
git add pages/occurrences/index.vue
git commit -m "feat: redesign occurrences page filter bar with compact toolbar and sortable headers"
```

---

## Task 5: Run all tests and final verification

**Step 1: Run full test suite**

Run: `npm run test`
Expected: All existing tests plus new filter tests pass.

**Step 2: Visual QA checklist**

- [ ] `/tasks` — compact toolbar renders inline
- [ ] `/tasks` — filter chips appear/disappear correctly
- [ ] `/tasks` — "Clear all" resets all filters
- [ ] `/tasks` — sortable column headers show amber chevron
- [ ] `/tasks` — clicking same header toggles asc/desc
- [ ] `/occurrences` — compact toolbar renders inline
- [ ] `/occurrences` — "Dates" button toggles date range row
- [ ] `/occurrences` — filter chips show for all active filters
- [ ] `/occurrences` — sortable column headers work
- [ ] Both pages — mobile view still works (card layout)
- [ ] Both pages — amber focus rings on all inputs
- [ ] Both pages — `rounded-lg` on all inputs (not `rounded-md`)

**Step 3: Commit**

If any fixes were needed during QA, commit them:

```
git commit -m "fix: polish filter bar styling and interactions"
```
