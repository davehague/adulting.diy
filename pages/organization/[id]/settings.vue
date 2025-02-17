<template>
    <div class="space-y-6">
        <!-- Settings Form Card -->
        <div class="bg-white shadow rounded-lg">
            <div class="p-6">
                <h2 class="text-lg font-medium text-gray-900 mb-6">General Settings</h2>
                <form @submit.prevent="handleUpdate" class="space-y-6">
                    <div v-if="error" class="bg-red-50 text-red-600 p-4 rounded-md">
                        {{ error }}
                    </div>

                    <!-- Organization Name -->
                    <div>
                        <label for="name" class="block text-sm font-medium text-gray-700">
                            Organization Name
                        </label>
                        <input id="name" v-model="formData.name" type="text" required
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            :disabled="loading" />
                    </div>

                    <!-- Description -->
                    <div>
                        <label for="description" class="block text-sm font-medium text-gray-700">
                            Description
                        </label>
                        <textarea id="description" v-model="formData.description" rows="3"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            :disabled="loading" />
                    </div>

                    <!-- Save Button -->
                    <div class="flex justify-end">
                        <button type="submit" :disabled="loading"
                            class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
                            {{ loading ? 'Saving...' : 'Save Changes' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Invite Management Card -->
        <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-medium text-gray-900 mb-6">Invitation Management</h2>
            <OrganizationInvites />
        </div>

        <!-- Danger Zone Card -->
        <div class="bg-white shadow rounded-lg">
            <div class="p-6">
                <h2 class="text-lg font-medium text-red-600">Danger Zone</h2>
                <p class="mt-1 text-sm text-gray-500">
                    Once you delete an organization, there is no going back. Please be certain.
                </p>
                <button @click="showDeleteModal = true"
                    class="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                    Delete Organization
                </button>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <div v-if="showDeleteModal"
            class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 class="text-lg font-medium text-gray-900 mb-4">Delete Organization</h3>
                <p class="text-sm text-gray-500">
                    This action cannot be undone. To confirm, please type the organization name
                    <span class="font-medium">{{ organizationStore.currentOrganization?.name }}</span>
                    below:
                </p>

                <input v-model="deleteConfirmation" type="text"
                    class="mt-4 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                    placeholder="Enter organization name" />

                <div class="mt-6 flex justify-end space-x-4">
                    <button @click="showDeleteModal = false"
                        class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
                        Cancel
                    </button>
                    <button @click="handleDelete"
                        :disabled="loading || deleteConfirmation !== organizationStore.currentOrganization?.name"
                        class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50">
                        {{ loading ? 'Deleting...' : 'Delete Organization' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOrganizationStore } from '@/stores/organization'
import type { Organization } from '@/types/organization'
import OrganizationInvites from '@/components/organization/OrganizationInvites.vue'

const router = useRouter()
const organizationStore = useOrganizationStore()

const loading = ref(false)
const error = ref<string | null>(null)
const deleteConfirmation = ref('')
const showDeleteModal = ref(false)

const formData = ref({
    name: '',
    description: ''
})

onMounted(() => {
    if (organizationStore.currentOrganization) {
        formData.value = {
            name: organizationStore.currentOrganization.name,
            description: organizationStore.currentOrganization.description || ''
        }
    }
})

const handleUpdate = async () => {
    if (!organizationStore.currentOrganization) return

    loading.value = true
    error.value = null

    try {
        await organizationStore.updateOrganization({
            id: organizationStore.currentOrganization.id,
            ...formData.value
        })

    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to update organization'
    } finally {
        loading.value = false
    }
}

const handleDelete = async () => {
    if (!organizationStore.currentOrganization) return

    if (deleteConfirmation.value !== organizationStore.currentOrganization.name) {
        error.value = 'Organization name does not match'
        return
    }

    loading.value = true
    error.value = null

    try {
        await organizationStore.deleteOrganization(organizationStore.currentOrganization.id)
        showDeleteModal.value = false
        router.push('/organization/create')
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to delete organization'
    } finally {
        loading.value = false
    }
}
</script>