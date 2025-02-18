// components/task/TaskForm.vue
<template>
    <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Title -->
        <div>
            <label class="block text-sm font-medium text-gray-700">Title</label>
            <input v-model="formData.title" required placeholder="Task title"
                class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>

        <!-- Description -->
        <div>
            <label class="block text-sm font-medium text-gray-700">Description (Optional)</label>
            <textarea v-model="formData.description" placeholder="Description"
                class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24" />
        </div>

        <!-- Reminders -->
        <div class="grid grid-cols-3 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700">Initial Reminder (days before)</label>
                <input v-model.number="formData.initial_reminder" type="number" min="0" required
                    class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">Follow-up Reminder (days before)</label>
                <input v-model.number="formData.follow_up_reminder" type="number" min="0" required
                    class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">Overdue Reminder (days after)</label>
                <input v-model.number="formData.overdue_reminder" type="number" min="0" required
                    class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
        </div>

        <!-- Recurrence -->
        <div class="space-y-4">
            <label class="flex items-center space-x-2">
                <input v-model="formData.recurring" type="checkbox"
                    class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" @change="handleRecurringChange" />
                <span class="text-sm font-medium text-gray-700">Recurring Task</span>
            </label>

            <div v-if="formData.recurring" class="pl-6">
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
                <input v-model="formData.is_active" type="checkbox"
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
import { type Task, type RecurrencePattern } from '@/types/tasks'
import { formatRecurrencePattern } from '@/utils/formatters'
import { useTaskActions } from '@/composables/useTasks'
import RecurrencePatternModal from '@/components/task/RecurrencePatternModal.vue'

const props = defineProps<{
    task?: Task | null
}>()

const emit = defineEmits<{
    save: [task: Partial<Task>]
    cancel: []
}>()

const { saveRecurrencePattern } = useTaskActions()

const showRecurrenceModal = ref(false)
const selectedPattern = ref<RecurrencePattern | null>(null)

// Initialize form with default values
const formData = ref<Partial<Task>>({
    title: '',
    description: '',
    initial_reminder: 1,
    follow_up_reminder: 0,
    overdue_reminder: 1,
    recurring: false,
    is_active: true,
    ...props.task // Spread existing task data if editing
})

const isFormValid = computed(() => {
    return (
        formData.value.title?.trim() &&
        typeof formData.value.initial_reminder === 'number' &&
        typeof formData.value.follow_up_reminder === 'number' &&
        typeof formData.value.overdue_reminder === 'number' &&
        (!formData.value.recurring || (formData.value.recurring && selectedPattern.value))
    )
})

const handleRecurringChange = (event: Event) => {
    const isRecurring = (event.target as HTMLInputElement).checked
    formData.value.recurring = isRecurring
    if (!isRecurring) {
        selectedPattern.value = null
        formData.value.recurrence_pattern_id = undefined
    }
}

const handleRecurrenceSelect = async (pattern: RecurrencePattern) => {
    selectedPattern.value = pattern
    showRecurrenceModal.value = false
}

const handleRecurrenceModalClose = () => {
    showRecurrenceModal.value = false
    if (!selectedPattern.value && formData.value.recurring) {
        formData.value.recurring = false
    }
}

const handleSubmit = async (event: Event) => {
    event.preventDefault()
    if (!isFormValid.value) return

    try {
        // If recurring, ensure we have a pattern ID
        if (formData.value.recurring && selectedPattern.value) {
            const patternId = await saveRecurrencePattern(selectedPattern.value)
            formData.value.recurrence_pattern_id = patternId
        }

        emit('save', formData.value)
    } catch (error) {
        console.error('Error saving task:', error)
        // You might want to handle this error in the UI
    }
}
</script>