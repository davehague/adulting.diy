<template>
  <form class="space-y-4" novalidate @submit.prevent="onSubmit">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label for="pf-name" class="block text-sm font-medium text-stone-700">Name <span class="text-red-600">*</span></label>
        <input id="pf-name" v-model="draft.name" type="text" :class="inputClass"
               :aria-invalid="!!errors.name" aria-describedby="pf-name-err">
        <p v-if="errors.name" id="pf-name-err" class="mt-1 text-sm text-red-600">{{ errors.name }}</p>
      </div>
      <div>
        <label for="pf-category" class="block text-sm font-medium text-stone-700">Category <span class="text-red-600">*</span></label>
        <select id="pf-category" v-model="draft.categoryId" :class="inputClass"
                :aria-invalid="!!errors.categoryId" aria-describedby="pf-category-err">
          <option value="">Select a category</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <p v-if="errors.categoryId" id="pf-category-err" class="mt-1 text-sm text-red-600">{{ errors.categoryId }}</p>
      </div>
      <div>
        <label for="pf-status" class="block text-sm font-medium text-stone-700">Status</label>
        <select id="pf-status" v-model="draft.statusId" :class="inputClass">
          <option value="">Default</option>
          <option v-for="s in statuses" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </div>
      <div>
        <label for="pf-company" class="block text-sm font-medium text-stone-700">Company</label>
        <input id="pf-company" v-model="draft.company" type="text" :class="inputClass">
      </div>
      <div>
        <label for="pf-contact" class="block text-sm font-medium text-stone-700">Primary contact</label>
        <input id="pf-contact" v-model="draft.primaryContactName" type="text" :class="inputClass">
      </div>
      <div>
        <label for="pf-phone" class="block text-sm font-medium text-stone-700">Phone</label>
        <input id="pf-phone" v-model="draft.phone" type="tel" :class="inputClass">
      </div>
      <div>
        <label for="pf-email" class="block text-sm font-medium text-stone-700">Email</label>
        <input id="pf-email" v-model="draft.email" type="email" :class="inputClass">
      </div>
      <div>
        <label for="pf-website" class="block text-sm font-medium text-stone-700">Website</label>
        <input id="pf-website" v-model="draft.website" type="text" :class="inputClass">
      </div>
      <div class="sm:col-span-2">
        <label for="pf-address" class="block text-sm font-medium text-stone-700">Address</label>
        <input id="pf-address" v-model="draft.address" type="text" :class="inputClass">
      </div>
      <div>
        <label for="pf-license" class="block text-sm font-medium text-stone-700">License number</label>
        <input id="pf-license" v-model="draft.licenseNumber" type="text" :class="inputClass">
      </div>
      <div>
        <label for="pf-place" class="block text-sm font-medium text-stone-700">Google Place ID</label>
        <input id="pf-place" v-model="draft.googlePlaceId" type="text" :class="inputClass">
      </div>
      <div>
        <label for="pf-rating" class="block text-sm font-medium text-stone-700">Rating</label>
        <select id="pf-rating" v-model="draft.rating" :class="inputClass">
          <option value="">No rating</option>
          <option v-for="n in 5" :key="n" :value="String(n)">{{ n }} star{{ n !== 1 ? 's' : '' }}</option>
        </select>
      </div>
      <div>
        <label for="pf-hired" class="block text-sm font-medium text-stone-700">Hired date</label>
        <input id="pf-hired" v-model="draft.hiredAt" type="date" :class="inputClass">
      </div>
      <div class="sm:col-span-2">
        <label for="pf-notes" class="block text-sm font-medium text-stone-700">Private notes (only your household sees these)</label>
        <textarea id="pf-notes" v-model="draft.notes" rows="4" :class="inputClass" />
      </div>
    </div>

    <div class="flex flex-wrap justify-end gap-2">
      <button type="button" class="px-4 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50"
              :disabled="saving" @click="emit('cancel')">
        Cancel
      </button>
      <button type="submit" class="px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              :disabled="saving">
        {{ saving ? 'Saving...' : 'Save provider' }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import {
  type ProviderCategoryDto,
  type ProviderInput,
  type ProviderStatusDto,
} from '@/types/provider';

interface ProviderDraft {
  name: string;
  categoryId: string;
  statusId: string;
  company: string;
  primaryContactName: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  licenseNumber: string;
  googlePlaceId: string;
  rating: string;
  hiredAt: string;
  notes: string;
}

const props = defineProps<{
  modelValue: ProviderInput;
  categories: ProviderCategoryDto[];
  statuses: ProviderStatusDto[];
  saving: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit', value: ProviderInput): void;
  (e: 'cancel'): void;
}>();

const inputClass = 'mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm';

const toDateInput = (value: Date | string | null | undefined): string =>
  value ? new Date(value).toISOString().slice(0, 10) : '';

const initial = props.modelValue;
const draft = reactive<ProviderDraft>({
  name: initial.name ?? '',
  categoryId: initial.categoryId ?? '',
  statusId: initial.statusId ?? '',
  company: initial.company ?? '',
  primaryContactName: initial.primaryContactName ?? '',
  phone: initial.phone ?? '',
  email: initial.email ?? '',
  website: initial.website ?? '',
  address: initial.address ?? '',
  licenseNumber: initial.licenseNumber ?? '',
  googlePlaceId: initial.googlePlaceId ?? '',
  rating: initial.rating ? String(initial.rating) : '',
  hiredAt: toDateInput(initial.hiredAt),
  notes: initial.notes ?? '',
});

const errors = reactive<{ name: string; categoryId: string }>({ name: '', categoryId: '' });

const nullable = (value: string): string | null => (value.trim() ? value.trim() : null);

const onSubmit = (): void => {
  errors.name = draft.name.trim() ? '' : 'Name is required';
  errors.categoryId = draft.categoryId ? '' : 'Category is required';
  if (errors.name || errors.categoryId) return;

  const payload: ProviderInput = {
    name: draft.name.trim(),
    categoryId: draft.categoryId,
    company: nullable(draft.company),
    primaryContactName: nullable(draft.primaryContactName),
    phone: nullable(draft.phone),
    email: nullable(draft.email),
    website: nullable(draft.website),
    address: nullable(draft.address),
    licenseNumber: nullable(draft.licenseNumber),
    googlePlaceId: nullable(draft.googlePlaceId),
    rating: draft.rating ? Number(draft.rating) : null,
    hiredAt: draft.hiredAt ? new Date(`${draft.hiredAt}T00:00:00.000Z`) : null,
    notes: nullable(draft.notes),
  };
  if (draft.statusId) payload.statusId = draft.statusId;
  emit('submit', payload);
};
</script>
