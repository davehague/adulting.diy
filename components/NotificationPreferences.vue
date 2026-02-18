<template>
  <div class="bg-stone-50 rounded p-4">
    <div v-if="loading" class="text-center py-4">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
    </div>
    
    <form v-else @submit.prevent="savePreferences" class="space-y-6">
      <!-- Task Notifications -->
      <div>
        <h4 class="text-sm font-medium text-stone-900 mb-3">Task Notifications</h4>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-sm text-stone-700">Task Created</label>
            <select v-model="preferences.task_created" class="px-3 py-1 border border-stone-300 rounded-md text-sm">
              <option value="any">Any task</option>
              <option value="none">None</option>
            </select>
          </div>
          
          <div class="flex items-center justify-between">
            <label class="text-sm text-stone-700">Task Paused</label>
            <select v-model="preferences.task_paused" class="px-3 py-1 border border-stone-300 rounded-md text-sm">
              <option value="any">Any task</option>
              <option value="none">None</option>
            </select>
          </div>
          
          <div class="flex items-center justify-between">
            <label class="text-sm text-stone-700">Task Completed</label>
            <select v-model="preferences.task_completed" class="px-3 py-1 border border-stone-300 rounded-md text-sm">
              <option value="any">Any task</option>
              <option value="none">None</option>
            </select>
          </div>
          
          <div class="flex items-center justify-between">
            <label class="text-sm text-stone-700">Task Deleted</label>
            <select v-model="preferences.task_deleted" class="px-3 py-1 border border-stone-300 rounded-md text-sm">
              <option value="any">Any task</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- Occurrence Notifications -->
      <div>
        <h4 class="text-sm font-medium text-stone-900 mb-3">Occurrence Notifications</h4>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-sm text-stone-700">Occurrence Assigned</label>
            <select v-model="preferences.occurrence_assigned" class="px-3 py-1 border border-stone-300 rounded-md text-sm">
              <option value="any">Any occurrence</option>
              <option value="mine">My occurrences only</option>
              <option value="none">None</option>
            </select>
          </div>
          
          <div class="flex items-center justify-between">
            <label class="text-sm text-stone-700">Occurrence Completed</label>
            <select v-model="preferences.occurrence_executed" class="px-3 py-1 border border-stone-300 rounded-md text-sm">
              <option value="any">Any occurrence</option>
              <option value="mine">My occurrences only</option>
              <option value="none">None</option>
            </select>
          </div>
          
          <div class="flex items-center justify-between">
            <label class="text-sm text-stone-700">Occurrence Skipped</label>
            <select v-model="preferences.occurrence_skipped" class="px-3 py-1 border border-stone-300 rounded-md text-sm">
              <option value="any">Any occurrence</option>
              <option value="mine">My occurrences only</option>
              <option value="none">None</option>
            </select>
          </div>
          
          <div class="flex items-center justify-between">
            <label class="text-sm text-stone-700">Occurrence Commented</label>
            <select v-model="preferences.occurrence_commented" class="px-3 py-1 border border-stone-300 rounded-md text-sm">
              <option value="any">Any occurrence</option>
              <option value="mine">My occurrences only</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- Reminder Notifications -->
      <div>
        <h4 class="text-sm font-medium text-stone-900 mb-3">Reminder Notifications</h4>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-sm text-stone-700">Initial Reminder</label>
            <select v-model="preferences.reminder_initial" class="px-3 py-1 border border-stone-300 rounded-md text-sm">
              <option value="any">All tasks</option>
              <option value="mine">My tasks only</option>
              <option value="none">Disabled</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm text-stone-700">Follow-up Reminder</label>
            <select v-model="preferences.reminder_followup" class="px-3 py-1 border border-stone-300 rounded-md text-sm">
              <option value="any">All tasks</option>
              <option value="mine">My tasks only</option>
              <option value="none">Disabled</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm text-stone-700">Overdue Reminder</label>
            <select v-model="preferences.reminder_overdue" class="px-3 py-1 border border-stone-300 rounded-md text-sm">
              <option value="any">All tasks</option>
              <option value="mine">My tasks only</option>
              <option value="none">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="pt-4 border-t border-stone-200">
        <button
          type="submit"
          :disabled="saving"
          class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
        >
          <Check :size="16" />{{ saving ? 'Saving...' : 'Save Preferences' }}
        </button>
        
        <div v-if="saveMessage" class="mt-2 text-sm" :class="saveError ? 'text-red-600' : 'text-green-600'">
          {{ saveMessage }}
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Check } from 'lucide-vue-next';
import type { NotificationPreferences } from '@/types/notification';

const loading = ref(true);
const saving = ref(false);
const saveMessage = ref('');
const saveError = ref(false);

const preferences = ref<NotificationPreferences>({
  task_created: 'any',
  task_paused: 'any',
  task_completed: 'any',
  task_deleted: 'any',
  occurrence_assigned: 'mine',
  occurrence_executed: 'mine',
  occurrence_skipped: 'mine',
  occurrence_commented: 'mine',
  reminder_initial: 'mine',
  reminder_followup: 'mine',
  reminder_overdue: 'mine'
});

// Load current preferences
onMounted(async () => {
  try {
    const response = await $fetch('/api/user/notifications', {
      headers: useRequestHeaders(['cookie'])
    });
    
    if (response) {
      preferences.value = response;
    }
  } catch (error) {
    console.error('Failed to load notification preferences:', error);
  } finally {
    loading.value = false;
  }
});

// Save preferences
const savePreferences = async () => {
  saving.value = true;
  saveMessage.value = '';
  saveError.value = false;
  
  try {
    await $fetch('/api/user/notifications', {
      method: 'PUT',
      body: preferences.value,
      headers: useRequestHeaders(['cookie'])
    });
    
    saveMessage.value = 'Preferences saved successfully!';
    saveError.value = false;
  } catch (error) {
    console.error('Failed to save preferences:', error);
    saveMessage.value = 'Failed to save preferences. Please try again.';
    saveError.value = true;
  } finally {
    saving.value = false;
    
    // Clear message after 3 seconds
    setTimeout(() => {
      saveMessage.value = '';
    }, 3000);
  }
};
</script>