<template>
  <div v-if="show"
    class="fixed inset-0 z-10 overflow-y-auto bg-stone-500 bg-opacity-75 transition-opacity"
    aria-labelledby="complete-modal-title" role="dialog" aria-modal="true">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div
        class="relative transform overflow-hidden rounded-xl bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <div>
          <h3 class="text-lg font-medium leading-6 text-stone-900 font-heading" id="complete-modal-title">Complete Occurrence</h3>
          <div class="mt-4">
            <div>
              <label for="completion-date" class="block text-sm font-medium text-stone-700">Completion Date & Time</label>
              <input
                id="completion-date"
                v-model="completionDate"
                type="datetime-local"
                class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            @click="handleConfirm"
            :disabled="disabled || !completionDate"
            class="inline-flex items-center justify-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 sm:col-start-2">
            <CheckCircle :size="16" />{{ disabled ? 'Completing...' : 'Complete' }}
          </button>
          <button
            type="button"
            @click="handleCancel"
            :disabled="disabled"
            class="mt-3 inline-flex items-center justify-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-50 sm:col-start-1 sm:mt-0">
            <X :size="16" />Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, toRefs } from 'vue';
import { CheckCircle, X } from 'lucide-vue-next';
import { format } from 'date-fns';

const props = defineProps<{
  show: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'confirm', completionDate: string): void;
  (e: 'cancel'): void;
}>();

const completionDate = ref(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

// Reset date to today each time the modal opens
const { show } = toRefs(props);
watch(show, (newVal) => {
  if (newVal) {
    completionDate.value = format(new Date(), "yyyy-MM-dd'T'HH:mm");
  }
});

const handleConfirm = () => {
  emit('confirm', completionDate.value);
};

const handleCancel = () => {
  completionDate.value = format(new Date(), "yyyy-MM-dd'T'HH:mm");
  emit('cancel');
};
</script>
