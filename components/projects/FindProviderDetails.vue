<template>
  <div class="flex min-h-0 flex-col">
    <div class="min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
      <button type="button"
              class="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
              @click="emit('back')">
        <ArrowLeft :size="16" />Back to results
      </button>

      <p v-if="loading" class="text-sm text-stone-600">Loading...</p>
      <p v-else-if="error" class="text-sm text-stone-600">
        {{ error }}
        <button type="button" class="font-medium text-amber-700 hover:text-amber-800" @click="load">Try again</button>
      </p>

      <template v-else-if="provider">
        <div>
          <h3 class="text-lg font-semibold text-stone-900 font-heading break-words">{{ provider.name }}</h3>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="statusClass(provider.status.kind)">{{ provider.status.name }}</span>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700">
              {{ provider.category.name }}
            </span>
          </div>
        </div>

        <dl class="grid grid-cols-1 gap-y-2 text-sm">
          <div v-if="provider.company"><dt class="text-stone-500">Company</dt><dd class="text-stone-900 break-words">{{ provider.company }}</dd></div>
          <div v-if="provider.primaryContactName"><dt class="text-stone-500">Primary contact</dt><dd class="text-stone-900 break-words">{{ provider.primaryContactName }}</dd></div>
          <div v-if="provider.phone">
            <dt class="text-stone-500">Phone</dt>
            <dd>
              <a v-if="telHref(provider.phone)" :href="telHref(provider.phone) ?? undefined" class="text-amber-700 hover:text-amber-800">{{ provider.phone }}</a>
              <span v-else class="text-stone-900 break-words">{{ provider.phone }}</span>
            </dd>
          </div>
          <div v-if="provider.rating"><dt class="text-stone-500">Rating</dt><dd class="text-stone-900">{{ provider.rating }}/5</dd></div>
          <div v-if="provider.notes"><dt class="text-stone-500">Notes</dt><dd class="text-stone-900 whitespace-pre-wrap break-words">{{ provider.notes }}</dd></div>
        </dl>

        <section>
          <h4 class="text-base font-semibold text-stone-900 font-heading mb-2">
            Neighbor mentions
            <span class="block sm:inline text-sm font-normal text-stone-500">
              {{ provider.mentionCount }} mention{{ provider.mentionCount !== 1 ? 's' : '' }} · {{ provider.neighborCount }} neighbor recommendation{{ provider.neighborCount !== 1 ? 's' : '' }}
            </span>
          </h4>
          <p v-if="provider.evidence.length === 0" class="text-sm text-stone-500">No neighbor evidence yet.</p>
          <ul v-else class="space-y-3">
            <li v-for="item in provider.evidence" :key="item.id" class="text-sm border border-stone-200 rounded-lg p-3">
              <div class="flex flex-wrap items-center gap-2 text-stone-600">
                <span v-if="item.sourceDate">{{ formatDate(item.sourceDate) }}</span>
                <span v-if="item.sourceGroup" class="break-words">{{ item.sourceGroup }}</span>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{{ kindLabel(item.kind) }}</span>
              </div>
              <p v-if="item.snippet" class="mt-2 text-stone-700 whitespace-pre-wrap break-words">{{ item.snippet }}</p>
              <a v-if="isHttpUrl(item.sourceUrl)"
                 :href="item.sourceUrl"
                 target="_blank"
                 rel="noopener noreferrer"
                 class="mt-2 inline-block text-amber-700 hover:text-amber-800">View source</a>
            </li>
          </ul>
        </section>

        <section>
          <h4 class="text-base font-semibold text-stone-900 font-heading mb-2">Comments</h4>
          <p v-if="provider.comments.length === 0" class="text-sm text-stone-500">No comments yet.</p>
          <ul v-else class="space-y-3">
            <li v-for="comment in provider.comments" :key="comment.id" class="text-sm">
              <div class="flex flex-wrap items-baseline gap-x-2">
                <span class="font-medium text-stone-900 break-words">{{ comment.author.name }}</span>
                <span class="text-xs text-stone-500">{{ formatCommentDate(comment.createdAt) }}</span>
              </div>
              <p class="mt-0.5 text-stone-700 whitespace-pre-wrap break-words">{{ comment.body }}</p>
            </li>
          </ul>
        </section>
      </template>
    </div>

    <div v-if="provider" class="shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-stone-200 px-4 py-3">
      <NuxtLink :to="`/providers/${provider.id}`" class="text-sm font-medium text-amber-700 hover:text-amber-800">
        Open full provider page
      </NuxtLink>
      <span v-if="linked" class="text-sm font-medium text-stone-500">On this project</span>
      <button v-else
              type="button"
              :disabled="linking"
              class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
              @click="emit('add')">
        Add to project
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-vue-next';
import { type EvidenceKind, type ProviderDetail, type ProviderStatusKind } from '@/types/provider';
import { useProviders } from '@/composables/useProviders';
import { telHref } from '@/utils/project-providers';

const props = defineProps<{
  providerId: string;
  // the provider is already on the project
  linked: boolean;
  // a link request is in flight
  linking: boolean;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'add'): void;
}>();

const { getProvider } = useProviders();

const provider = ref<ProviderDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error ? e.message : fallback);

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

// Date-only values are stored as UTC midnight; format their UTC calendar day so local timezones don't shift it.
const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const [y, m, d] = parsed.toISOString().slice(0, 10).split('-').map(Number);
  return format(new Date(y, m - 1, d), 'MMM d, yyyy');
};

// A comment's createdAt is a real moment, so it shows in the viewer's own calendar day.
const formatCommentDate = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, 'MMM d, yyyy');
};

// Only http(s) URLs become links, so a stray javascript: value is never clickable.
const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

// Ignore a slow response for a provider the user has since navigated away from.
let latestRequestId = 0;

const load = async (): Promise<void> => {
  const requestId = ++latestRequestId;
  provider.value = null;
  loading.value = true;
  error.value = null;
  try {
    const result = await getProvider(props.providerId);
    if (requestId !== latestRequestId) return;
    provider.value = result;
  } catch (e) {
    if (requestId !== latestRequestId) return;
    error.value = messageOf(e, 'Could not load the provider');
  } finally {
    if (requestId === latestRequestId) loading.value = false;
  }
};

watch(() => props.providerId, load);
onMounted(load);
onBeforeUnmount(() => {
  latestRequestId++;
});
</script>
