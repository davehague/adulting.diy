<template>
  <div v-if="show"
       class="fixed inset-0 z-50 overflow-y-auto bg-stone-500 bg-opacity-75"
       aria-labelledby="mark-done-title"
       role="dialog"
       aria-modal="true">
    <!-- Tapping the dimmed area (this wrapper itself, not the panel inside it) is the same as "Not yet". -->
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0" @click.self="cancel">
      <div class="relative transform overflow-hidden rounded-xl bg-white px-4 pb-4 pt-5 text-left shadow-xl sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <h3 id="mark-done-title" class="text-lg font-medium leading-6 text-stone-900 font-heading">Mark project Done?</h3>
        <p class="mt-3 text-sm text-stone-600 break-words">
          <template v-if="afterLastStep">
            That was the last step of <span class="font-medium text-stone-900">{{ projectTitle }}</span>. Mark the project Done?
          </template>
          <template v-else>
            Mark <span class="font-medium text-stone-900">{{ projectTitle }}</span> Done?
          </template>
        </p>
        <p v-if="error" class="mt-3 text-sm text-red-700" aria-live="polite">{{ error }}</p>
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button type="button"
                  :disabled="saving"
                  class="inline-flex w-full items-center justify-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 sm:col-start-2"
                  @click="emit('confirm')">
            <Check :size="16" />{{ saving ? 'Saving...' : 'Mark Done' }}
          </button>
          <button type="button"
                  :disabled="saving"
                  class="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-2 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-50 sm:col-start-1 sm:mt-0"
                  @click="cancel">
            <X :size="16" />Not yet
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue';
import { Check, X } from 'lucide-vue-next';

const props = defineProps<{
  show: boolean;
  projectTitle: string;
  // true when the dialog follows the last step being checked; false when a project row itself was checked
  afterLastStep: boolean;
  saving?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const cancel = (): void => {
  if (!props.saving) emit('cancel');
};

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') cancel();
};

// Escape only matters while the dialog is open. `show` starts false, so nothing touches `window` during SSR.
watch(() => props.show, (show) => {
  if (show) window.addEventListener('keydown', onKeydown);
  else window.removeEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>
