<template>
  <div v-if="visible" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay -->
      <div class="fixed inset-0 bg-stone-500 bg-opacity-75 transition-opacity" @click="cancel"></div>

      <!-- Spacer for centering -->
      <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

      <!-- Modal panel -->
      <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 sm:mx-0 sm:h-10 sm:w-10">
              <svg class="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 class="text-lg leading-6 font-medium text-stone-900" id="modal-title">
                Catch Up — {{ taskName }}
              </h3>
              <div class="mt-2">
                <p class="text-sm text-stone-500">
                  This task has <span class="font-semibold text-stone-700">{{ overdueCount }} overdue occurrence{{ overdueCount !== 1 ? 's' : '' }}</span>.
                  They will be marked as skipped.
                </p>
              </div>

              <!-- Next due date -->
              <div class="mt-4">
                <label for="catch-up-date" class="block text-sm font-medium text-stone-700">
                  Next due date
                </label>
                <p class="text-xs text-stone-400 mb-1">Calculated from the schedule. Change it if you'd like a different date.</p>
                <input
                  id="catch-up-date"
                  type="date"
                  v-model="selectedDate"
                  :min="minDate"
                  class="block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm"
                />
              </div>

              <div class="mt-4">
                <label for="catch-up-comment" class="block text-sm font-medium text-stone-700">
                  Add a reason (optional)
                </label>
                <textarea
                  id="catch-up-comment"
                  v-model="comment"
                  rows="2"
                  class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm"
                  placeholder="e.g., Was on vacation"
                ></textarea>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-stone-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
          <button
            type="button"
            :disabled="submitting || !selectedDate"
            @click="confirmCatchUp"
            class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            <FastForward :size="16" />{{ submitting ? 'Catching up...' : 'Catch Up' }}
          </button>
          <button
            type="button"
            :disabled="submitting"
            @click="cancel"
            class="inline-flex items-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-50"
          >
            <X :size="16" />Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { FastForward, X } from 'lucide-vue-next';

const props = defineProps<{
  visible: boolean;
  taskName: string;
  overdueCount: number;
  calculatedNextDueDate: string | null;
}>();

const emit = defineEmits<{
  (e: 'confirm', payload: { comment: string; overrideNextDueDate?: string }): void;
  (e: 'cancel'): void;
}>();

const comment = ref('');
const selectedDate = ref('');
const submitting = ref(false);
const initialDate = ref('');

// When the calculated date prop changes (modal opens), pre-fill the date input
watch(() => props.calculatedNextDueDate, (val) => {
  if (val) {
    const dateStr = new Date(val).toISOString().split('T')[0];
    selectedDate.value = dateStr;
    initialDate.value = dateStr;
  } else {
    selectedDate.value = '';
    initialDate.value = '';
  }
});

const minDate = computed(() => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
});

const confirmCatchUp = () => {
  submitting.value = true;
  const dateChanged = selectedDate.value !== initialDate.value;
  emit('confirm', {
    comment: comment.value,
    overrideNextDueDate: dateChanged ? selectedDate.value : undefined,
  });
};

const cancel = () => {
  comment.value = '';
  selectedDate.value = '';
  emit('cancel');
};

defineExpose({
  reset: () => {
    comment.value = '';
    selectedDate.value = '';
    initialDate.value = '';
    submitting.value = false;
  },
});
</script>
