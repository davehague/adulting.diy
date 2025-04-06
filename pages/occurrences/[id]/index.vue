<template>
    <div class="container mx-auto px-4 py-8">
        <!-- Loading and Error States -->
        <div v-if="loading" class="text-center py-8">
            <p class="text-gray-600">Loading occurrence details...</p>
        </div>
        <div v-else-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{{ error }}</p>
            <div class="mt-2">
                <!-- Provide appropriate back link, maybe to task or general occurrences list -->
                <NuxtLink v-if="occurrence?.taskId" :to="`/tasks/${occurrence.taskId}/occurrences`"
                    class="text-blue-600 hover:text-blue-800 mr-4">
                    Back to Task Occurrences
                </NuxtLink>
                <NuxtLink to="/occurrences" class="text-blue-600 hover:text-blue-800">
                    Back to All Occurrences
                </NuxtLink>
            </div>
        </div>

        <!-- Occurrence Details -->
        <div v-else-if="occurrence" class="space-y-8">
            <!-- Header -->
            <div class="flex justify-between items-start">
                <div>
                    <NuxtLink v-if="occurrence.task" :to="`/tasks/${occurrence.task.id}`"
                        class="text-blue-600 hover:text-blue-800 mb-1 block text-sm">
                        &larr; Task: {{ occurrence.task.name }}
                    </NuxtLink>
                    <h1 class="text-2xl font-bold text-gray-900">Occurrence Details</h1>
                    <p class="text-gray-500">Due: {{ formatDate(occurrence.dueDate) }}</p>
                </div>
                <!-- Action Buttons (Edit, Execute, Skip, Comment) -->
                <div class="flex space-x-2">
                    <button @click="openEditModal"
                        class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Edit</button>
                    <button v-if="occurrence.status === 'assigned' || occurrence.status === 'created'"
                        @click="handleExecute" class="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">
                        Execute
                    </button>
                    <button v-if="occurrence.status === 'assigned' || occurrence.status === 'created'"
                        @click="handleSkip" class="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600">
                        Skip
                    </button>
                    <button @click="openCommentModal"
                        class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600">Comment</button>
                </div>
            </div>

            <!-- Details Card -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h2 class="text-lg font-semibold mb-3">Details</h2>
                        <dl class="space-y-2">
                            <div>
                                <dt class="text-sm font-medium text-gray-500">Status</dt>
                                <dd class="mt-1 text-sm text-gray-900">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                                        :class="getOccurrenceStatusClass(occurrence.status)">
                                        {{ formatOccurrenceStatus(occurrence.status) }}
                                    </span>
                                </dd>
                            </div>
                            <div v-if="occurrence.completedAt">
                                <dt class="text-sm font-medium text-gray-500">Completed At</dt>
                                <dd class="mt-1 text-sm text-gray-900">{{ formatDateTime(occurrence.completedAt) }}
                                </dd>
                            </div>
                            <div v-if="occurrence.skippedAt">
                                <dt class="text-sm font-medium text-gray-500">Skipped At</dt>
                                <dd class="mt-1 text-sm text-gray-900">{{ formatDateTime(occurrence.skippedAt) }}</dd>
                            </div>
                        </dl>
                    </div>
                    <div>
                        <h2 class="text-lg font-semibold mb-3">Assignees</h2>
                        <!-- TODO: Fetch and display user names -->
                        <p v-if="!occurrence.assigneeIds?.length" class="text-sm text-gray-500">No users assigned.</p>
                        <ul v-else class="list-disc pl-5 text-sm text-gray-900">
                            <li v-for="userId in occurrence.assigneeIds" :key="userId">{{ userId }} (Name Placeholder)
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- History Timeline -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <OccurrenceTimeline :occurrence-id="occurrenceId" />
            </div>

        </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal"
        class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
        <div class="relative mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div class="mt-3 text-center">
                <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">Edit Occurrence</h3>
                <div class="mt-2 px-7 py-3 text-left">
                    <OccurrenceEditForm v-if="occurrence" :occurrence="occurrence" @submit="handleUpdate"
                        @cancel="closeEditModal" ref="editFormRef" />
                    <!-- Add loading state for submission within the modal if needed -->
                </div>
                <!-- Modal close button (optional) -->
                <!-- <button @click="closeEditModal" class="absolute top-0 right-0 mt-4 mr-4 text-gray-400 hover:text-gray-600">
             &times;
           </button> -->
            </div>
        </div>
    </div>

    <!-- TODO: Add Modals for Skip Reason, Comment -->
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '@/utils/api';
import { useTaskStore } from '@/stores/tasks'; // Using task store for execute/skip actions
import OccurrenceTimeline from '@/components/occurrences/OccurrenceTimeline.vue';
import OccurrenceEditForm from '@/components/occurrences/OccurrenceEditForm.vue'; // Import the edit form
import type { TaskOccurrence } from '@/types'; // Assuming TaskOccurrence includes nested TaskDefinition after API call

const route = useRoute();
const router = useRouter();
const api = useApi();
const taskStore = useTaskStore();

// Occurrence ID from route params
const occurrenceId = route.params.id as string;

// State
const occurrence = ref<TaskOccurrence | null>(null);
const loading = ref(true);
const error = ref('');
const showEditModal = ref(false); // State for edit modal visibility
const editFormRef = ref<InstanceType<typeof OccurrenceEditForm> | null>(null); // Ref for edit form

// Fetch occurrence data
onMounted(async () => {
    await fetchOccurrence();
});

const fetchOccurrence = async () => {
    try {
        loading.value = true;
        error.value = '';
        // Fetch the specific occurrence, assuming API includes the parent task details
        const data = await api.get<TaskOccurrence>(`/api/occurrences/${occurrenceId}`);
        occurrence.value = data;
    } catch (err: any) {
        console.error('Error loading occurrence:', err);
        error.value = err.data?.message || 'Failed to load occurrence details.';
        occurrence.value = null; // Clear occurrence on error
    } finally {
        loading.value = false;
    }
};

// --- Action Handlers ---

const handleExecute = async () => {
    if (!occurrence.value) return;
    try {
        await taskStore.executeOccurrence(occurrenceId);
        await fetchOccurrence(); // Refetch details after action
    } catch (err) {
        console.error("Execute failed:", err);
        alert(`Error executing occurrence: ${taskStore.error || 'Unknown error'}`);
    }
};

const handleSkip = async () => {
    if (!occurrence.value) return;
    const reason = prompt('Please enter a reason for skipping this occurrence:');
    if (reason && reason.trim() !== '') {
        try {
            await taskStore.skipOccurrence(occurrenceId, reason.trim());
            await fetchOccurrence(); // Refetch details after action
        } catch (err) {
            console.error("Skip failed:", err);
            alert(`Error skipping occurrence: ${taskStore.error || 'Unknown error'}`);
        }
    } else if (reason !== null) {
        alert('A reason is required to skip an occurrence.');
    }
};

const openEditModal = () => {
    if (!occurrence.value) return; // Don't open if occurrence not loaded
    showEditModal.value = true;
};

const closeEditModal = () => {
    showEditModal.value = false;
};

// Handle the update submission from the edit form
const handleUpdate = async (formData: { dueDate: string, assigneeIds: string[] }) => {
    if (!occurrence.value) return;

    // Access the form's submitting state if needed
    // Note: The OccurrenceEditForm manages its own isSubmitting state internally for the button
    // but we might want a loading indicator on the page level too.

    try {
        // Convert date string back to Date object if necessary for the store action
        const updatePayload = {
            dueDate: new Date(formData.dueDate), // Convert string back to Date
            assigneeIds: formData.assigneeIds
        };
        await taskStore.updateOccurrence(occurrenceId, updatePayload);

        if (taskStore.error) {
            // Throw error to be caught below if store indicates failure
            throw new Error(taskStore.error);
        }

        closeEditModal();
        await fetchOccurrence(); // Refetch details after successful update
        alert('Occurrence updated successfully!'); // Simple feedback

    } catch (err) {
        console.error("Update failed:", err);
        // Display error within the modal or use a notification system
        // For now, just alert
        alert(`Error updating occurrence: ${taskStore.error || 'Please check details and try again.'}`);
        // We don't necessarily close the modal on error, let the user correct it.
    } finally {
        // If we had a page-level submitting state, set it back here.
        // The form button's disabled state is handled within OccurrenceEditForm.
    }
};

const openCommentModal = async () => {
    const comment = prompt('Enter your comment:');
    if (comment && comment.trim() !== '') {
        try {
            await taskStore.commentOnOccurrence(occurrenceId, comment.trim());
            // Success! Maybe show a notification.
            // The timeline component should ideally refetch itself or be triggered to refetch.
            // For now, we can manually trigger a refetch of the whole occurrence page
            // or rely on the user refreshing/navigating.
            alert('Comment added successfully!');
            // Consider adding a refetch for the timeline component here if possible
        } catch (err) {
            console.error("Comment failed:", err);
            alert(`Error adding comment: ${taskStore.error || 'Unknown error'}`);
        }
    } else if (comment !== null) { // Only show alert if prompt wasn't cancelled
        alert('Comment cannot be empty.');
    }
    // TODO: Implement Comment Modal properly
};


// --- Helper Functions ---
const formatDate = (date: Date | string | undefined): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

const formatDateTime = (date: Date | string | undefined): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
};

const formatOccurrenceStatus = (status: string | undefined): string => {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
};

const getOccurrenceStatusClass = (status: string | undefined): string => {
    if (!status) return 'bg-gray-100 text-gray-800';
    switch (status) {
        case 'created': return 'bg-gray-100 text-gray-800';
        case 'assigned': return 'bg-blue-100 text-blue-800';
        case 'completed': return 'bg-green-100 text-green-800';
        case 'skipped': return 'bg-yellow-100 text-yellow-800';
        case 'deleted': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};
</script>