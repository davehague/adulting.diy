<template>
  <div v-if="show"
    class="fixed inset-0 z-10 overflow-y-auto bg-stone-500 bg-opacity-75 transition-opacity"
    aria-labelledby="skip-modal-title" role="dialog" aria-modal="true">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div
        class="relative transform overflow-hidden rounded-xl bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <div>
          <h3 class="text-lg font-medium leading-6 text-stone-900 font-heading" id="skip-modal-title">Skip Occurrence</h3>
          <div class="mt-4">
            <p v-if="isVariableInterval" class="text-sm text-amber-700 bg-amber-50 p-3 rounded mb-4">
              This is a variable-interval task. The next occurrence will be scheduled based on today's date rather than the original due date.
            </p>
            <p class="text-sm text-stone-500 mb-4">
              Optionally provide a reason for skipping this task occurrence.
            </p>
            <div>
              <label for="skip-reason" class="block text-sm font-medium text-stone-700">Reason</label>
              <textarea
                id="skip-reason"
                v-model="skipReason"
                rows="3"
                class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm"
                placeholder="Enter a reason for skipping (optional)..."
              />
            </div>
          </div>
        </div>
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            @click="handleConfirm"
            :disabled="disabled"
            class="inline-flex w-full justify-center rounded-md bg-yellow-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-600 disabled:opacity-50 sm:col-start-2 transition-colors duration-150">
            {{ disabled ? 'Skipping...' : 'Skip' }}
          </button>
          <button
            type="button"
            @click="handleCancel"
            :disabled="disabled"
            class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm ring-1 ring-inset ring-stone-300 hover:bg-stone-50 sm:col-start-1 sm:mt-0 disabled:opacity-50 transition-colors duration-150">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  show: boolean;
  isVariableInterval?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'confirm', reason: string): void;
  (e: 'cancel'): void;
}>();

const skipReason = ref('');

const handleConfirm = () => {
  emit('confirm', skipReason.value.trim());
  skipReason.value = '';
};

const handleCancel = () => {
  skipReason.value = '';
  emit('cancel');
};
</script>
