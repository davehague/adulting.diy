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
            <div class="relative mt-1">
                <div class="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md min-h-[42px]">
                    <!-- Selected users -->
                    <div v-for="userId in formData.occurrence.assigned_to" :key="userId"
                        class="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {{organizationStore.members.find(m => m.user_id === userId)?.user.name ||
                            organizationStore.members.find(m => m.user_id === userId)?.user.email}}
                        <button type="button" @click="removeAssignee(userId)" class="text-blue-600 hover:text-blue-800">
                            ×
                        </button>
                    </div>
                    <!-- Input for filtering -->
                    <input v-model="assigneeSearch" @focus="showAssigneeDropdown = true" placeholder="Search members..."
                        class="flex-1 min-w-[120px] outline-none border-none p-0" />
                </div>

                <!-- Dropdown -->
                <div v-if="showAssigneeDropdown"
                    class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div v-for="member in filteredMembers" :key="member.id" @click="addAssignee(member.user_id)"
                        class="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                        {{ member.user.name || member.user.email }}
                    </div>
                    <div v-if="filteredMembers.length === 0" class="px-4 py-2 text-gray-500">
                        No members found
                    </div>
                </div>
            </div>
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
                <div v-if="isLoadingPattern" class="p-3 bg-gray-50 rounded-md">
                    <span class="text-sm text-gray-500">Loading pattern...</span>
                </div>
                <div v-else-if="selectedPattern" class="flex items-center justify-between p-3 bg-gray-50 rounded-md">
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
import { ref, computed, onMounted, watch } from 'vue'
import { type Task, type RecurrencePattern, type TaskOccurrence } from '@/types/tasks'
import { formatRecurrencePattern } from '@/utils/formatters'
import { useTaskActions } from '@/composables/useTasks'
import { useTaskStore } from '@/stores/tasks'

import { useOrganizationStore } from '@/stores/organization'
import RecurrencePatternModal from '@/components/task/RecurrencePatternModal.vue'

const taskStore = useTaskStore()

const props = defineProps<{
    task?: Task | null
    currentOccurrence?: TaskOccurrence | null
}>()

const emit = defineEmits<{
    save: [task: Partial<Task>, occurrence: Partial<TaskOccurrence>]
    cancel: []
}>()

const { saveRecurrencePattern } = useTaskActions()
const organizationStore = useOrganizationStore()

const showRecurrenceModal = ref(false)
const selectedPattern = ref<RecurrencePattern | null>(null)

const assigneeSearch = ref('')
const showAssigneeDropdown = ref(false)

const isLoadingPattern = ref(false)

// Initialize form with default values
const formData = ref<{
    task: Partial<Task>
    occurrence: Partial<TaskOccurrence> & {
        assigned_to: string[]
    }
}>({
    task: {
        title: '',
        description: '',
        initial_reminder: 1,
        follow_up_reminder: 0,
        overdue_reminder: 1,
        recurring: false,
        is_active: true,
        ...props.task, // This stays the same
        // Add organization_id if creating new task
        organization_id: props.task?.organization_id || organizationStore.currentOrganization?.id
    },
    occurrence: {
        due_date: props.currentOccurrence?.due_date
            ? new Date(props.currentOccurrence.due_date).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
        assigned_to: props.currentOccurrence?.assigned_to || [],
        status: (props.currentOccurrence?.status || 'pending') as TaskOccurrence['status'],
        // Add task_id if editing
        task_id: props.task?.id,
        // Add id if editing occurrence
        ...(props.currentOccurrence?.id ? { id: props.currentOccurrence.id } : {})
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
    } else if (props.task?.recurrence_pattern_id) {
        // If checking and we have a pattern ID, load it
        loadRecurrencePattern()
    }
}

const loadRecurrencePattern = async () => {
    if (!props.task?.recurrence_pattern_id) return

    try {
        isLoadingPattern.value = true
        const pattern = await taskStore.fetchRecurrencePattern(props.task.recurrence_pattern_id)
        selectedPattern.value = pattern
    } catch (error) {
        console.error('Error loading recurrence pattern:', error)
    } finally {
        isLoadingPattern.value = false
    }
}


const filteredMembers = computed(() => {
    return organizationStore.members.filter(member => {
        const searchTerm = assigneeSearch.value.toLowerCase()
        const userName = (member.user.name || '').toLowerCase()
        const userEmail = (member.user.email || '').toLowerCase()
        const isNotSelected = !formData.value.occurrence.assigned_to.includes(member.user_id)

        return isNotSelected && (userName.includes(searchTerm) || userEmail.includes(searchTerm))
    })
})

const addAssignee = (userId: string) => {
    if (!formData.value.occurrence.assigned_to.includes(userId)) {
        formData.value.occurrence.assigned_to.push(userId)
    }
    assigneeSearch.value = ''
}

const removeAssignee = (userId: string) => {
    formData.value.occurrence.assigned_to = formData.value.occurrence.assigned_to.filter(id => id !== userId)
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

onMounted(() => {
    console.log('Task form mounted', props.task, props.currentOccurrence)
    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement
        if (!target.closest('.relative')) {
            showAssigneeDropdown.value = false
        }
    })
})

watch(() => props.task, async (newTask) => {
    if (newTask?.recurring && newTask.recurrence_pattern_id) {
        await loadRecurrencePattern()
    } else {
        selectedPattern.value = null
    }
}, { immediate: true })
</script>