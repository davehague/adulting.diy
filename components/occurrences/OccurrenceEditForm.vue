<template>
    <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Due Date Field -->
        <div>
            <label for="dueDate" class="block text-sm font-medium text-gray-700">Due Date*</label>
            <input id="dueDate" v-model="formData.dueDate" type="date" required
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>

        <!-- Assignees Field -->
        <div>
            <label for="assignees" class="block text-sm font-medium text-gray-700">Assignees</label>
            <div v-if="loadingUsers" class="text-sm text-gray-500">Loading users...</div>
            <div v-else-if="userError" class="text-sm text-red-600">{{ userError }}</div>
            <div v-else class="mt-1 max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                <div v-for="user in householdUsers" :key="user.id">
                    <label class="inline-flex items-center">
                        <input type="checkbox" :value="user.id" v-model="formData.assigneeIds"
                            class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" />
                        <span class="ml-2 text-sm">{{ user.name }} ({{ user.email }})</span>
                    </label>
                </div>
            </div>
            <p v-if="!loadingUsers && !userError && !householdUsers.length" class="text-sm text-gray-500 mt-1">
                No other users found in this household.
            </p>
        </div>

        <!-- Validation Errors -->
        <div v-if="validationError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
            <p>{{ validationError }}</p>
        </div>

        <!-- Form Buttons -->
        <div class="flex justify-end space-x-3 pt-2">
            <button type="button" @click="handleCancel"
                class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Cancel
            </button>
            <button type="submit"
                class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                :disabled="isSubmitting">
                {{ isSubmitting ? 'Saving...' : 'Save Changes' }}
            </button>
        </div>
    </form>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watchEffect } from 'vue';
import { useApi } from '@/utils/api';
import type { TaskOccurrence, User } from '@/types';

// Props
interface Props {
    occurrence: TaskOccurrence;
}
const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
    (e: 'submit', data: { dueDate: string, assigneeIds: string[] }): void;
    (e: 'cancel'): void;
}>();

// Setup
const api = useApi();
const householdUsers = ref<User[]>([]);
const loadingUsers = ref(true);
const userError = ref('');
const isSubmitting = ref(false);
const validationError = ref('');

// Form data structure
const formData = reactive({
    dueDate: '',
    assigneeIds: [] as string[],
});

// Load household users and initialize form
onMounted(async () => {
    await fetchHouseholdUsers();
    initializeForm();
});

// Watch for prop changes to re-initialize (if component is reused)
watchEffect(() => {
    initializeForm();
});

const initializeForm = () => {
    if (props.occurrence) {
        // Format date to YYYY-MM-DD for input[type="date"]
        try {
            formData.dueDate = props.occurrence.due_date ? new Date(props.occurrence.due_date).toISOString().split('T')[0] : '';
        } catch (e) {
            console.error("Error formatting due date:", e);
            formData.dueDate = ''; // Fallback
        }
        formData.assigneeIds = props.occurrence.assignee_ids ? [...props.occurrence.assignee_ids] : [];
    }
};

const fetchHouseholdUsers = async () => {
    try {
        loadingUsers.value = true;
        userError.value = '';
        // Assuming GET /api/household/users returns User[]
        const users = await api.get<User[]>('/api/household/users');
        householdUsers.value = users;
    } catch (err: any) {
        console.error('Error fetching household users:', err);
        userError.value = 'Failed to load household users.';
    } finally {
        loadingUsers.value = false;
    }
};

// Form validation
const validateForm = () => {
    validationError.value = '';
    if (!formData.dueDate) {
        validationError.value = 'Due date is required.';
        return false;
    }
    // Basic date format check
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.dueDate)) {
        validationError.value = 'Due date must be in YYYY-MM-DD format.';
        return false;
    }
    return true;
};

// Handle form submission
const handleSubmit = () => {
    if (!validateForm()) {
        return;
    }
    isSubmitting.value = true;
    emit('submit', { ...formData });
    // Parent component will handle actual API call and set isSubmitting back to false
};

const handleCancel = () => {
    emit('cancel');
};
</script>