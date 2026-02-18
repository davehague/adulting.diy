<template>
    <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Due Date Field -->
        <div>
            <label for="edit-dueDate" class="block text-sm font-medium text-stone-700">Due Date*</label>
            <input id="edit-dueDate" v-model="formData.dueDate" type="date" required
                class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500" />
        </div>

        <!-- Assignees Field -->
        <div>
            <label class="block text-sm font-medium text-stone-700">Assignees</label>
            <div v-if="loadingUsers" class="text-sm text-stone-500">Loading users...</div>
            <div v-else-if="userError" class="text-sm text-red-600">{{ userError }}</div>
            <div v-else-if="householdUsers.length > 0"
                class="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                <div v-for="user in householdUsers" :key="user.id">
                    <label class="inline-flex items-center">
                        <input type="checkbox" :value="user.id" v-model="formData.assigneeIds"
                            class="rounded border-stone-300 text-amber-700 shadow-sm focus:border-amber-300 focus:ring focus:ring-amber-200 focus:ring-opacity-50" />
                        <span class="ml-2 text-sm">{{ user.name }} ({{ user.email }})</span>
                    </label>
                </div>
            </div>
            <p v-else class="text-sm text-stone-500 mt-1">No users found in household to assign.</p>
        </div>

        <!-- Validation Error -->
        <div v-if="validationError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
            <p>{{ validationError }}</p>
        </div>

        <!-- Form Buttons -->
        <div class="flex justify-end space-x-3 pt-2">
            <button type="button" @click="handleCancel"
                class="inline-flex items-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                <X :size="16" />Cancel
            </button>
            <button type="submit"
                class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                :disabled="isSubmitting">
                <Check :size="16" />{{ isSubmitting ? 'Saving...' : 'Save Changes' }}
            </button>
        </div>
    </form>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { useApi } from '@/utils/api';
import { Check, X } from 'lucide-vue-next';
import type { TaskOccurrence, User } from '@/types';
import { format } from 'date-fns';

// Props
const props = defineProps<{
    occurrence: TaskOccurrence; // Pass the full occurrence object to pre-populate
}>();

// Emits
const emit = defineEmits<{
    (e: 'submit', data: { dueDate: string; assigneeIds: string[] }): void;
    (e: 'cancel'): void;
}>();

// Setup
const api = useApi();
const householdUsers = ref<Pick<User, 'id' | 'name' | 'email'>[]>([]);
const loadingUsers = ref(false);
const userError = ref<string | null>(null);
const isSubmitting = ref(false);
const validationError = ref<string | null>(null);

// Form data - initialized from prop
const formData = reactive({
    // Format date to YYYY-MM-DD for the input type="date"
    dueDate: props.occurrence.dueDate ? format(new Date(props.occurrence.dueDate), 'yyyy-MM-dd') : '',
    assigneeIds: [...(props.occurrence.assigneeIds || [])] // Clone array
});

// Watch for prop changes to reset form data if the occurrence prop updates
watch(() => props.occurrence, (newOccurrence) => {
    formData.dueDate = newOccurrence.dueDate ? format(new Date(newOccurrence.dueDate), 'yyyy-MM-dd') : '';
    formData.assigneeIds = [...(newOccurrence.assigneeIds || [])];
    validationError.value = null; // Reset validation on prop change
}, { deep: true });


// Fetch Household Users
const fetchHouseholdUsers = async () => {
    loadingUsers.value = true;
    userError.value = null;
    try {
        const data = await api.get<{ members: Pick<User, 'id' | 'name' | 'email'>[] }>('/api/household/users');
        householdUsers.value = data.members;
    } catch (err) {
        console.error('Error fetching household users:', err);
        userError.value = 'Failed to load users for assignment.';
    } finally {
        loadingUsers.value = false;
    }
};

// Load users on mount
onMounted(fetchHouseholdUsers);

// Form validation
const validateForm = () => {
    validationError.value = null; // Reset
    if (!formData.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(formData.dueDate)) {
        validationError.value = 'Due date is required and must be in YYYY-MM-DD format.';
        return false;
    }
    // Optional: Add validation for assigneeIds if needed (e.g., at least one?)
    return true;
};

// Handle form submission
const handleSubmit = () => {
    if (!validateForm()) {
        return;
    }
    isSubmitting.value = true; // Set submitting state (parent should reset on success/error)
    emit('submit', { ...formData }); // Emit only the necessary fields
};

// Handle cancellation
const handleCancel = () => {
    emit('cancel');
};

</script>