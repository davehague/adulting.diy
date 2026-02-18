# Inline Category Creation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to create new categories inline from the task create/edit form dropdowns.

**Architecture:** Extract the category `<select>` into a reusable `CategorySelect.vue` component that wraps a native select with a "+ New Category" option. When selected, it reveals an inline text input for the name, calls `POST /api/categories/create`, adds the result to the list, and auto-selects it. Both `TaskCreateForm.vue` and `TaskEditForm.vue` swap their current raw `<select>` for this component.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), TypeScript, Tailwind CSS, Lucide icons, existing `/api/categories/create` endpoint (no backend changes needed).

---

### Task 1: Create CategorySelect component

**Files:**
- Create: `components/tasks/CategorySelect.vue`

**Step 1: Create the component**

Create `components/tasks/CategorySelect.vue` with this implementation:

```vue
<template>
  <div>
    <label for="categoryId" class="block text-sm font-medium text-stone-700">Category*</label>

    <!-- Standard dropdown (shown when NOT creating) -->
    <div v-if="!isCreating" class="mt-1 flex gap-2">
      <select id="categoryId" :value="modelValue" @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)" required
        class="block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500">
        <option disabled value="">Select a category</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">
          {{ category.name }}
        </option>
      </select>
      <button type="button" @click="startCreating"
        class="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-amber-700 hover:text-amber-800 px-2 py-1 rounded-md hover:bg-amber-50 transition-colors"
        title="Add new category">
        <Plus :size="16" />
        <span class="hidden sm:inline">New</span>
      </button>
    </div>

    <!-- Inline creation mode -->
    <div v-else class="mt-1 flex gap-2">
      <input ref="newCategoryInput" v-model="newCategoryName" type="text" placeholder="Category name"
        class="block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
        @keydown.enter.prevent="createCategory" @keydown.escape="cancelCreating" />
      <button type="button" @click="createCategory" :disabled="!newCategoryName.trim() || isSaving"
        class="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-800 px-2 py-1 rounded-md hover:bg-green-50 transition-colors disabled:opacity-50"
        title="Save category">
        <Check :size="16" />
      </button>
      <button type="button" @click="cancelCreating"
        class="inline-flex items-center text-sm font-medium text-stone-500 hover:text-stone-700 px-2 py-1 rounded-md hover:bg-stone-100 transition-colors"
        title="Cancel">
        <X :size="16" />
      </button>
    </div>

    <!-- Error message -->
    <p v-if="error" class="mt-1 text-sm text-red-600">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { useApi } from '@/utils/api';
import { Plus, Check, X } from 'lucide-vue-next';
import type { Category } from '@/types';

const props = defineProps<{
  modelValue: string;
  categories: Category[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'categoryCreated', category: Category): void;
}>();

const api = useApi();
const isCreating = ref(false);
const isSaving = ref(false);
const newCategoryName = ref('');
const newCategoryInput = ref<HTMLInputElement | null>(null);
const error = ref('');

const startCreating = async () => {
  isCreating.value = true;
  error.value = '';
  newCategoryName.value = '';
  await nextTick();
  newCategoryInput.value?.focus();
};

const cancelCreating = () => {
  isCreating.value = false;
  newCategoryName.value = '';
  error.value = '';
};

const createCategory = async () => {
  const name = newCategoryName.value.trim();
  if (!name) return;

  isSaving.value = true;
  error.value = '';

  try {
    const category = await api.post<Category>('/api/categories/create', { name });
    emit('categoryCreated', category);
    emit('update:modelValue', category.id);
    isCreating.value = false;
    newCategoryName.value = '';
  } catch (err: any) {
    error.value = err?.data?.message || err?.message || 'Failed to create category';
  } finally {
    isSaving.value = false;
  }
};
</script>
```

**Step 2: Verify it compiles**

Run: `npx nuxi typecheck`
Expected: No errors related to CategorySelect

**Step 3: Commit**

```bash
git add components/tasks/CategorySelect.vue
git commit -m "feat: add CategorySelect component with inline creation"
```

---

### Task 2: Integrate CategorySelect into TaskCreateForm

**Files:**
- Modify: `components/tasks/TaskCreateForm.vue`

**Step 1: Replace the category `<select>` with `CategorySelect`**

In `TaskCreateForm.vue`:

1. Add the import (in `<script setup>`):
```typescript
import CategorySelect from '@/components/tasks/CategorySelect.vue';
```

2. Add a handler to push newly created categories into the local list:
```typescript
const onCategoryCreated = (category: Category) => {
  categories.value.push(category);
  categories.value.sort((a, b) => a.name.localeCompare(b.name));
};
```

3. Replace lines 11-21 (the `<!-- Category Field -->` block) with:
```vue
    <!-- Category Field -->
    <CategorySelect v-model="formData.categoryId" :categories="categories" @category-created="onCategoryCreated" />
```

**Step 2: Verify it compiles**

Run: `npx nuxi typecheck`
Expected: No errors related to TaskCreateForm

**Step 3: Commit**

```bash
git add components/tasks/TaskCreateForm.vue
git commit -m "feat: use CategorySelect in TaskCreateForm"
```

---

### Task 3: Integrate CategorySelect into TaskEditForm

**Files:**
- Modify: `components/tasks/TaskEditForm.vue`

**Step 1: Replace the category `<select>` with `CategorySelect`**

In `TaskEditForm.vue`:

1. Add the import (in `<script setup>`):
```typescript
import CategorySelect from '@/components/tasks/CategorySelect.vue';
```

2. Add a handler to push newly created categories into the local list:
```typescript
const onCategoryCreated = (category: Category) => {
  categories.value.push(category);
  categories.value.sort((a, b) => a.name.localeCompare(b.name));
};
```

3. Replace lines 11-21 (the `<!-- Category Field -->` block) with:
```vue
    <!-- Category Field -->
    <CategorySelect v-model="formData.categoryId" :categories="categories" @category-created="onCategoryCreated" />
```

**Step 2: Verify it compiles**

Run: `npx nuxi typecheck`
Expected: No errors related to TaskEditForm

**Step 3: Commit**

```bash
git add components/tasks/TaskEditForm.vue
git commit -m "feat: use CategorySelect in TaskEditForm"
```

---

### Task 4: Manual smoke test

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test create flow**
1. Navigate to create task page
2. Verify the category dropdown shows existing categories
3. Click "+ New" button
4. Type a new category name and press Enter (or click checkmark)
5. Verify the new category appears in the dropdown and is auto-selected
6. Verify pressing Escape cancels creation mode

**Step 3: Test edit flow**
1. Navigate to edit an existing task
2. Verify the category dropdown shows the task's current category selected
3. Create a new category inline
4. Verify it works the same as in the create flow

**Step 4: Test error case**
1. Try creating a category with a duplicate name
2. Verify an error message appears below the input
