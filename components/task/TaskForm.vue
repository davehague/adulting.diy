<template>
    <form @submit.prevent="createTask" class="space-y-6 max-w-2xl mx-auto p-4">
        <div>
            <input v-model="task.title" placeholder="Task title"
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>

        <div>
            <textarea v-model="task.description" placeholder="Description"
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24" />
        </div>

        <div class="grid grid-cols-3 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700">Initial Reminder (days)</label>
                <input v-model="task.initial_reminder" type="number" min="0"
                    class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">Follow-up Reminder (days)</label>
                <input v-model="task.follow_up_reminder" type="number" min="0"
                    class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">Overdue Reminder (days)</label>
                <input v-model="task.overdue_reminder" type="number" min="0"
                    class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
        </div>

        <div class="flex items-center space-x-4">
            <label class="flex items-center space-x-2">
                <input v-model="isRecurring" type="checkbox" class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    @change="showRecurrenceModal = isRecurring" />
                <span class="text-sm font-medium text-gray-700">Recurring Task</span>
            </label>

            <div v-if="selectedPattern" class="flex-1 flex items-center justify-between p-2 bg-gray-50 rounded-md">
                <span class="text-sm text-gray-600">{{ formatRecurrencePattern(selectedPattern) }}</span>
                <button type="button" @click="showRecurrenceModal = true"
                    class="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Edit
                </button>
            </div>
        </div>

        <div class="flex justify-end">
            <button type="submit"
                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                Create Task
            </button>
        </div>
    </form>

    <RecurrencePatternModal v-if="showRecurrenceModal" :pattern="selectedPattern" @select="handleRecurrenceSelect"
        @close="showRecurrenceModal = false" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { type Task, type RecurrencePattern } from '@/types/tasks'
import { formatRecurrencePattern } from '@/utils/formatters'
import { useTaskActions } from '@/composables/useTasks'
import RecurrencePatternModal from '@/components/task/RecurrencePatternModal.vue'
const isRecurring = ref(false)
const showRecurrenceModal = ref(false)
const selectedPattern = ref<RecurrencePattern | null>(null)

const { saveRecurrencePattern, saveTask } = useTaskActions()

const task = ref<Partial<Task>>({
    title: '',
    description: '',
    initial_reminder: 1,
    follow_up_reminder: 0,
    overdue_reminder: 1,
    recurring: false,
    is_active: true
})

const handleRecurrenceSelect = (pattern: RecurrencePattern) => {
    selectedPattern.value = pattern
    task.value.recurring = true
    task.value.recurrence_pattern_id = pattern.id
    showRecurrenceModal.value = false
}

const createTask = async () => {
    // First create/update recurrence pattern if needed
    if (isRecurring.value && selectedPattern.value) {
        // Save pattern first, then use its ID
        const patternId = await saveRecurrencePattern(selectedPattern.value)
        task.value.recurrence_pattern_id = patternId
    }

    // Then create the task
    await saveTask(task.value)
}
</script>