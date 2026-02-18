<template>
  <div v-if="show"
    class="fixed inset-0 z-10 overflow-y-auto bg-stone-500 bg-opacity-75 transition-opacity"
    aria-labelledby="delete-modal-title" role="dialog" aria-modal="true">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div
        class="relative transform overflow-hidden rounded-xl bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <div>
          <h3 class="text-lg font-medium leading-6 text-stone-900 font-heading" id="delete-modal-title">Delete Task</h3>
          <div class="mt-4">
            <p class="text-sm text-red-700 bg-red-50 p-3 rounded mb-4">
              This will remove the task and cancel all future pending occurrences. The task will no longer appear in your task list.
            </p>
            <p class="text-sm text-stone-500">
              Any occurrences that are already completed or skipped will be preserved in your history.
            </p>
          </div>
        </div>
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            @click="$emit('confirm')"
            :disabled="disabled"
            class="inline-flex items-center justify-center gap-1.5 bg-red-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 sm:col-start-2">
            <Trash2 :size="16" />{{ disabled ? 'Deleting...' : 'Delete Task' }}
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
import { Trash2, X } from 'lucide-vue-next';

defineProps<{
  show: boolean;
  disabled?: boolean;
}>();

defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();
</script>
