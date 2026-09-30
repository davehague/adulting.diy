<template>
  <div class="container mx-auto px-4 py-8 max-w-3xl">
    <NuxtLink to="/providers" class="text-sm text-amber-700 hover:text-amber-800">&larr; All providers</NuxtLink>

    <div v-if="error" class="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
      <h3 class="text-sm font-medium text-red-800">Error</h3>
      <div class="mt-1 text-sm text-red-700">{{ error }}</div>
    </div>

    <!-- Create mode -->
    <div v-if="isNew" class="mt-4 bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
      <h1 class="text-2xl font-bold text-stone-900 font-heading mb-4">Add provider</h1>
      <p v-if="loading" class="text-stone-600">Loading...</p>
      <ProviderForm v-else :model-value="emptyInput" :categories="categories" :statuses="statuses"
                    :saving="saving" @submit="onCreate" @cancel="navigateTo('/providers')" />
    </div>

    <p v-else-if="loading && !provider" class="mt-6 text-center text-stone-600">Loading provider...</p>

    <div v-else-if="provider" class="mt-4 space-y-4">
      <!-- Edit mode -->
      <section v-if="editing" class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
        <h1 class="text-2xl font-bold text-stone-900 font-heading mb-4">Edit provider</h1>
        <ProviderForm :model-value="toInput(provider)" :categories="categories" :statuses="statuses"
                      :saving="saving" @submit="onUpdate" @cancel="editing = false" />
      </section>

      <template v-else>
        <!-- Header -->
        <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h1 class="text-2xl font-bold text-stone-900 font-heading break-words">{{ provider.name }}</h1>
              <p v-if="provider.company" class="text-stone-600 break-words">{{ provider.company }}</p>
            </div>
            <div class="flex gap-2">
              <button type="button" class="px-3 py-1.5 text-sm font-medium rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50"
                      @click="editing = true">
                Edit
              </button>
              <button type="button" class="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                      @click="onDelete">
                Delete
              </button>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700">
              {{ provider.category.name }}
            </span>
            <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', statusClass(provider.status.kind)]">
              {{ provider.status.name }}
            </span>
            <span v-if="provider.rating" :aria-label="`Rating ${provider.rating} out of 5`" class="text-amber-600">
              {{ '★'.repeat(provider.rating) }}<span class="text-stone-300">{{ '★'.repeat(Math.max(0, 5 - provider.rating)) }}</span>
            </span>
          </div>
        </section>

        <!-- Contact details -->
        <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
          <h2 class="text-lg font-semibold text-stone-900 font-heading mb-3">Contact details</h2>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div v-if="provider.primaryContactName"><dt class="text-stone-500">Primary contact</dt><dd class="text-stone-900 break-words">{{ provider.primaryContactName }}</dd></div>
            <div v-if="provider.phone"><dt class="text-stone-500">Phone</dt><dd><a :href="`tel:${provider.phone}`" class="text-amber-700 hover:text-amber-800">{{ provider.phone }}</a></dd></div>
            <div v-if="provider.email"><dt class="text-stone-500">Email</dt><dd class="break-words"><a :href="`mailto:${provider.email}`" class="text-amber-700 hover:text-amber-800">{{ provider.email }}</a></dd></div>
            <div v-if="provider.website">
              <dt class="text-stone-500">Website</dt>
              <dd class="break-words">
                <a v-if="safeWebsite(provider.website)" :href="safeWebsite(provider.website)!" target="_blank" rel="noopener noreferrer"
                   class="text-amber-700 hover:text-amber-800">{{ provider.website }}</a>
                <span v-else class="text-stone-900">{{ provider.website }}</span>
              </dd>
            </div>
            <div v-if="provider.address"><dt class="text-stone-500">Address</dt><dd class="text-stone-900 break-words">{{ provider.address }}</dd></div>
            <div v-if="provider.licenseNumber"><dt class="text-stone-500">License</dt><dd class="text-stone-900 break-words">{{ provider.licenseNumber }}</dd></div>
            <div v-if="provider.googlePlaceId"><dt class="text-stone-500">Google Place ID</dt><dd class="text-stone-900 break-all">{{ provider.googlePlaceId }}</dd></div>
          </dl>
        </section>

        <!-- Additional contacts -->
        <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-stone-900 font-heading">Additional contacts</h2>
            <button v-if="!contactForm" type="button" class="text-sm text-amber-700 hover:text-amber-800" @click="startContact(null)">Add contact</button>
          </div>
          <p v-if="provider.contacts.length === 0 && !contactForm" class="text-sm text-stone-500">No additional contacts.</p>
          <ul class="space-y-2">
            <li v-for="c in provider.contacts" :key="c.id" class="text-sm border border-stone-200 rounded-lg p-3">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div class="min-w-0">
                  <span class="font-medium text-stone-900 break-words">{{ c.name }}</span>
                  <span v-if="c.role" class="text-stone-500"> · {{ c.role }}</span>
                  <div class="flex flex-wrap gap-x-4">
                    <a v-if="c.phone" :href="`tel:${c.phone}`" class="text-amber-700 hover:text-amber-800">{{ c.phone }}</a>
                    <a v-if="c.email" :href="`mailto:${c.email}`" class="text-amber-700 hover:text-amber-800 break-all">{{ c.email }}</a>
                  </div>
                </div>
                <div class="flex gap-3">
                  <button type="button" class="text-amber-700 hover:text-amber-800" @click="startContact(c)">Edit</button>
                  <button type="button" class="text-red-600 hover:text-red-700" @click="onDeleteContact(c.id)">Remove</button>
                </div>
              </div>
            </li>
          </ul>
          <form v-if="contactForm" class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3" novalidate @submit.prevent="onSaveContact">
            <div>
              <label for="c-name" class="block text-sm font-medium text-stone-700">Name <span class="text-red-600">*</span></label>
              <input id="c-name" v-model="contactForm.name" type="text" :class="inputClass">
              <p v-if="contactError" class="mt-1 text-sm text-red-600">{{ contactError }}</p>
            </div>
            <div>
              <label for="c-role" class="block text-sm font-medium text-stone-700">Role</label>
              <input id="c-role" v-model="contactForm.role" type="text" :class="inputClass">
            </div>
            <div>
              <label for="c-phone" class="block text-sm font-medium text-stone-700">Phone</label>
              <input id="c-phone" v-model="contactForm.phone" type="tel" :class="inputClass">
            </div>
            <div>
              <label for="c-email" class="block text-sm font-medium text-stone-700">Email</label>
              <input id="c-email" v-model="contactForm.email" type="email" :class="inputClass">
            </div>
            <div class="sm:col-span-2 flex justify-end gap-2">
              <button type="button" class="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50" @click="contactForm = null">Cancel</button>
              <button type="submit" class="px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700">Save contact</button>
            </div>
          </form>
        </section>

        <!-- Neighbor evidence -->
        <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
          <h2 class="text-lg font-semibold text-stone-900 font-heading mb-3">
            Neighbor evidence
            <span class="block sm:inline text-sm font-normal text-stone-500">
              {{ provider.mentionCount }} mention{{ provider.mentionCount !== 1 ? 's' : '' }} · {{ provider.neighborCount }} neighbor recommendation{{ provider.neighborCount !== 1 ? 's' : '' }}
            </span>
          </h2>
          <p v-if="provider.evidence.length === 0" class="text-sm text-stone-500">No neighbor evidence yet.</p>
          <ul v-else class="space-y-3">
            <li v-for="e in provider.evidence" :key="e.id" class="text-sm border border-stone-200 rounded-lg p-3">
              <div class="flex flex-wrap items-center gap-2 text-stone-600">
                <span v-if="e.sourceDate">{{ formatDate(e.sourceDate) }}</span>
                <span v-if="e.sourceGroup" class="break-words">{{ e.sourceGroup }}</span>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{{ kindLabel(e.kind) }}</span>
              </div>
              <p v-if="e.snippet" class="mt-2 text-stone-700 whitespace-pre-wrap break-words">{{ e.snippet }}</p>
              <a v-if="safeWebsite(e.sourceUrl)" :href="safeWebsite(e.sourceUrl)!" target="_blank" rel="noopener noreferrer"
                 class="mt-2 inline-block text-amber-700 hover:text-amber-800">View source</a>
            </li>
          </ul>
        </section>

        <!-- Private -->
        <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
          <h2 class="text-lg font-semibold text-stone-900 font-heading mb-3">Private</h2>
          <dl class="space-y-2 text-sm">
            <div><dt class="text-stone-500">Hired date</dt><dd class="text-stone-900">{{ provider.hiredAt ? formatDate(provider.hiredAt) : 'Not hired yet' }}</dd></div>
            <div>
              <dt class="text-stone-500">Notes</dt>
              <dd class="text-stone-900 whitespace-pre-wrap break-words">{{ provider.notes || 'No notes.' }}</dd>
            </div>
          </dl>
        </section>

        <!-- Linked tasks -->
        <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
          <h2 class="text-lg font-semibold text-stone-900 font-heading mb-3">Linked tasks</h2>
          <p v-if="provider.tasks.length === 0" class="text-sm text-stone-500">No tasks linked.</p>
          <ul v-else class="space-y-1 text-sm">
            <li v-for="t in provider.tasks" :key="t.task.id">
              <NuxtLink :to="`/tasks/${t.task.id}`" class="text-amber-700 hover:text-amber-800 break-words">{{ t.task.name }}</NuxtLink>
            </li>
          </ul>
        </section>

        <!-- Comments -->
        <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
          <h2 class="text-lg font-semibold text-stone-900 font-heading mb-3">Comments</h2>
          <ProviderCommentList :comments="provider.comments" :current-user-id="currentUserId"
                               @add="onAddComment" @update="onUpdateComment" @remove="onRemoveComment" />
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { format } from 'date-fns';
import { useRoute } from '#imports';
import {
  type EvidenceKind,
  type ProviderCategoryDto,
  type ProviderContactDto,
  type ProviderContactInput,
  type ProviderDetail,
  type ProviderInput,
  type ProviderStatusDto,
  type ProviderStatusKind,
} from '@/types/provider';
import { useProviders } from '@/composables/useProviders';
import { useAuthStore } from '@/stores/auth';
import ProviderForm from '@/components/providers/ProviderForm.vue';
import ProviderCommentList from '@/components/providers/ProviderCommentList.vue';

const route = useRoute();
const authStore = useAuthStore();
const {
  getProvider, createProvider, updateProvider, deleteProvider, listCategories, listStatuses,
  addComment, updateComment, deleteComment, addContact, updateContact, deleteContact,
} = useProviders();

const id = computed(() => String(route.params.id));
const isNew = computed(() => id.value === 'new');
const currentUserId = computed(() => authStore.user?.id ?? null);

const provider = ref<ProviderDetail | null>(null);
const categories = ref<ProviderCategoryDto[]>([]);
const statuses = ref<ProviderStatusDto[]>([]);
const loading = ref(true);
const saving = ref(false);
const editing = ref(false);
const error = ref<string | null>(null);

const contactForm = ref<{ id: string | null; name: string; role: string; phone: string; email: string } | null>(null);
const contactError = ref('');

const emptyInput: ProviderInput = { name: '', categoryId: '' };
const inputClass = 'mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm';

const errorMessage = (e: unknown, fallback: string): string => (e instanceof Error ? e.message : fallback);

const statusClass = (kind: ProviderStatusKind): string => {
  if (kind === 'positive') return 'bg-green-100 text-green-800';
  if (kind === 'negative') return 'bg-red-50 text-red-700';
  return 'bg-stone-100 text-stone-700';
};

const kindLabel = (kind: EvidenceKind): string => {
  if (kind === 'third_party') return 'Neighbor recommendation';
  if (kind === 'self_promo') return 'Self-promotion';
  return 'Lead';
};

const formatDate = (value: string): string => format(new Date(value), 'MMM d, yyyy');

// Only http(s) URLs become links, so a stray javascript: value is shown as text.
const safeWebsite = (value: string): string | null => {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

const toInput = (p: ProviderDetail): ProviderInput => ({
  name: p.name,
  categoryId: p.category.id,
  statusId: p.status.id,
  company: p.company,
  primaryContactName: p.primaryContactName,
  phone: p.phone,
  email: p.email,
  website: p.website,
  address: p.address,
  licenseNumber: p.licenseNumber,
  googlePlaceId: p.googlePlaceId,
  rating: p.rating,
  hiredAt: p.hiredAt ? new Date(p.hiredAt) : null,
  notes: p.notes,
});

const reload = async (): Promise<void> => {
  provider.value = await getProvider(id.value);
};

const run = async (action: () => Promise<void>, fallback: string): Promise<boolean> => {
  try {
    await action();
    error.value = null;
    return true;
  } catch (e) {
    error.value = errorMessage(e, fallback);
    return false;
  }
};

const onCreate = async (input: ProviderInput): Promise<void> => {
  saving.value = true;
  let createdId = '';
  const ok = await run(async () => {
    createdId = (await createProvider(input)).id;
  }, 'Failed to create provider');
  saving.value = false;
  if (ok) await navigateTo(`/providers/${createdId}`);
};

const onUpdate = async (input: ProviderInput): Promise<void> => {
  saving.value = true;
  const ok = await run(async () => {
    await updateProvider(id.value, input);
    await reload();
  }, 'Failed to save provider');
  saving.value = false;
  if (ok) editing.value = false;
};

const onDelete = async (): Promise<void> => {
  if (!confirm('Remove this provider?')) return;
  const ok = await run(async () => {
    await deleteProvider(id.value);
  }, 'Failed to delete provider');
  if (ok) await navigateTo('/providers');
};

const onAddComment = (body: string): Promise<boolean> =>
  run(async () => { await addComment(id.value, body); await reload(); }, 'Failed to add comment');
const onUpdateComment = (commentId: string, body: string): Promise<boolean> =>
  run(async () => { await updateComment(id.value, commentId, body); await reload(); }, 'Failed to update comment');
const onRemoveComment = (commentId: string): Promise<boolean> =>
  run(async () => { await deleteComment(id.value, commentId); await reload(); }, 'Failed to delete comment');

const startContact = (c: ProviderContactDto | null): void => {
  contactError.value = '';
  contactForm.value = {
    id: c?.id ?? null,
    name: c?.name ?? '',
    role: c?.role ?? '',
    phone: c?.phone ?? '',
    email: c?.email ?? '',
  };
};

const onSaveContact = async (): Promise<void> => {
  const form = contactForm.value;
  if (!form) return;
  if (!form.name.trim()) {
    contactError.value = 'Name is required';
    return;
  }
  const input: ProviderContactInput = {
    name: form.name.trim(),
    role: form.role.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
  };
  const ok = await run(async () => {
    if (form.id) await updateContact(id.value, form.id, input);
    else await addContact(id.value, input);
    await reload();
  }, 'Failed to save contact');
  if (ok) contactForm.value = null;
};

const onDeleteContact = async (contactId: string): Promise<void> => {
  if (!confirm('Remove this contact?')) return;
  await run(async () => { await deleteContact(id.value, contactId); await reload(); }, 'Failed to remove contact');
};

onMounted(async () => {
  loading.value = true;
  await run(async () => {
    [categories.value, statuses.value] = await Promise.all([listCategories(), listStatuses()]);
    if (!isNew.value) await reload();
  }, 'Failed to load provider');
  loading.value = false;
});
</script>
