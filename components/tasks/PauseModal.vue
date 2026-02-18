<template>
  <div v-if="show"
    class="fixed inset-0 z-10 overflow-y-auto bg-stone-500 bg-opacity-75 transition-opacity"
    aria-labelledby="pause-modal-title" role="dialog" aria-modal="true">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div
        class="relative transform overflow-hidden rounded-xl bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <div>
          <h3 class="text-lg font-medium leading-6 text-stone-900 font-heading" id="pause-modal-title">Pause Task</h3>
          <div class="mt-4">
            <p class="text-sm text-amber-700 bg-amber-50 p-3 rounded mb-4">
              Pausing this task will cancel all future pending occurrences. No new occurrences will be generated until the task is unpaused.
            </p>
            <p class="text-sm text-stone-500">
              Any occurrences that are already completed or skipped will not be affected.
            </p>
          </div>
        </div>
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            @click="$emit('confirm')"
            :disabled="disabled"
            class="inline-flex items-center justify-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 sm:col-start-2">
            <Pause :size="16" />{{ disabled ? 'Pausing...' : 'Pause Task' }}
          </button>
          <button
            type="button"
            @click="$emit('cancel')"
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
import { Pause, X } from 'lucide-vue-next';

defineProps<{
  show: boolean;
  disabled?: boolean;
}>();

defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();
</script>
