<template>
    <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Title -->
        <div>
            <label class="block text-sm font-medium text-gray-700">Title</label>
            <input v-model="formData.task.title" required placeholder="Task title"
                class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>

        <!-- Description -->
        <div>
            <label class="block text-sm font-medium text-gray-700">Description (Optional)</label>
            <textarea v-model="formData.task.description" placeholder="Description"
                class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24" />
        </div>

        <!-- Due Date -->
        <div>
            <label class="block text-sm font-medium text-gray-700">Due Date</label>
            <input v-model="formData.occurrence.due_date" type="date" required
                :min="new Date().toISOString().split('T')[0]"
                class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>

        <!-- Assignees -->
        <div>
            <label class="block text-sm font-medium text-gray-700">Assign To</label>
            <select v-model="formData.occurrence.assigned_to" multiple
                class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option v-for="member in organizationStore.members" :key="member.id" :value="member.user_id">
                    {{ member.user.name || member.user.email }}
                </option>
            </select>
        </div>

        <!-- Reminders -->
        <div class="grid grid-cols-3 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700">Initial Reminder (days before)</label>
                <input v-model.number="formData.task.initial_reminder" type="number" min="0" required
                    class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">Follow-up Reminder (days before)</label>
                <input v-model.number="formData.task.follow_up_reminder" type="number" min="0" required
                    class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">Overdue Reminder (days after)</label>
                <input v-model.number="formData.task.overdue_reminder" type="number" min="0" required
                    class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
        </div>

        <!-- Recurrence -->
        <div class="space-y-4">
            <label class="flex items-center space-x-2">
                <input v-model="formData.task.recurring" type="checkbox"
                    class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" @change="handleRecurringChange" />
                <span class="text-sm font-medium text-gray-700">Recurring Task</span>
            </label>

            <div v-if="formData.task.recurring" class="pl-6">
                <div v-if="selectedPattern" class="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <span class="text-sm text-gray-600">{{ formatRecurrencePattern(selectedPattern) }}</span>
                    <button type="button" @click="showRecurrenceModal = true"
                        class="text-blue-600 hover:text-blue-700 text-sm font-medium">
                        Edit Pattern
                    </button>
                </div>
                <button v-else type="button" @click="showRecurrenceModal = true"
                    class="w-full px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50">
                    Set Recurrence Pattern
                </button>
            </div>
        </div>

        <!-- Active Status -->
        <div>
            <label class="flex items-center space-x-2">
                <input v-model="formData.task.is_active" type="checkbox"
                    class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                <span class="text-sm font-medium text-gray-700">Active Task</span>
            </label>
        </div>

        <!-- Form Actions -->
        <div class="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" @click="emit('cancel')"
                class="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                Cancel
            </button>
            <button type="submit" :disabled="!isFormValid" :class="[
                'px-4 py-2 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                isFormValid ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-not-allowed'
            ]">
                {{ props.task ? 'Update' : 'Create' }} Task
            </button>
        </div>
    </form>

    <RecurrencePatternModal v-if="showRecurrenceModal" :pattern="selectedPattern" @select="handleRecurrenceSelect"
        @close="handleRecurrenceModalClose" />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { type Task, type RecurrencePattern, type TaskOccurrence } from '@/types/tasks'
import { formatRecurrencePattern } from '@/utils/formatters'
import { useTaskActions } from '@/composables/useTasks'
import { useOrganizationStore } from '@/stores/organization'
import RecurrencePatternModal from '@/components/task/RecurrencePatternModal.vue'

const props = defineProps<{
    task?: Task | null
}>()

const emit = defineEmits<{
    save: [task: Partial<Task>, occurrence: Partial<TaskOccurrence>]
    cancel: []
}>()

const { saveRecurrencePattern } = useTaskActions()
const organizationStore = useOrganizationStore()

const showRecurrenceModal = ref(false)
const selectedPattern = ref<RecurrencePattern | null>(null)

// Initialize form with default values
const formData = ref<{
    task: Partial<Task>
    occurrence: Partial<TaskOccurrence>
}>({
    task: {
        title: '',
        description: '',
        initial_reminder: 1,
        follow_up_reminder: 0,
        overdue_reminder: 1,
        recurring: false,
        is_active: true,
        ...props.task // Spread existing task data if editing
    },
    occurrence: {
        due_date: new Date().toISOString().split('T')[0], // Today's date as default
        assigned_to: [] as string[], // Explicitly type and initialize as empty array
        status: 'pending' as TaskOccurrence['status'] // Explicitly type the status
    }
})

const isFormValid = computed(() => {
    return (
        formData.value.task.title?.trim() &&
        formData.value.occurrence.due_date &&
        typeof formData.value.task.initial_reminder === 'number' &&
        typeof formData.value.task.follow_up_reminder === 'number' &&
        typeof formData.value.task.overdue_reminder === 'number' &&
        (!formData.value.task.recurring || (formData.value.task.recurring && selectedPattern.value))
    )
})

const handleRecurringChange = (event: Event) => {
    const isRecurring = (event.target as HTMLInputElement).checked
    formData.value.task.recurring = isRecurring
    if (!isRecurring) {
        selectedPattern.value = null
        formData.value.task.recurrence_pattern_id = undefined
    }
}

const handleRecurrenceSelect = async (pattern: RecurrencePattern) => {
    selectedPattern.value = pattern
    showRecurrenceModal.value = false
}

const handleRecurrenceModalClose = () => {
    showRecurrenceModal.value = false
    if (!selectedPattern.value && formData.value.task.recurring) {
        formData.value.task.recurring = false
    }
}

const handleSubmit = async (event: Event) => {
    event.preventDefault()
    if (!isFormValid.value) return

    try {
        // If recurring, ensure we have a pattern ID
        if (formData.value.task.recurring && selectedPattern.value) {
            const patternId = await saveRecurrencePattern(selectedPattern.value)
            formData.value.task.recurrence_pattern_id = patternId
        }

        emit('save', formData.value.task, formData.value.occurrence)
    } catch (error) {
        console.error('Error saving task:', error)
        // You might want to handle this error in the UI
    }
}
</script>