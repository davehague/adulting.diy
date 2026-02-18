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
  if (!name || isSaving.value) return;

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
