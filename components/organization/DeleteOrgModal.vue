<template>
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Delete Organization</h3>
            <p class="text-sm text-gray-500">
                This action cannot be undone. To confirm, please type the organization name
                <span class="font-medium">{{ organizationStore.currentOrganization?.name }}</span>
                below:
            </p>

            <input v-model="confirmationText" type="text"
                class="mt-4 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                placeholder="Enter organization name" />

            <div class="mt-6 flex justify-end space-x-4">
                <button @click="emit('close')"
                    class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
                    Cancel
                </button>
                <button @click="handleDelete"
                    :disabled="loading || confirmationText !== organizationStore.currentOrganization?.name"
                    class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50">
                    {{ loading ? 'Deleting...' : 'Delete Organization' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useOrganizationStore } from '@/stores/organization'

const router = useRouter()
const organizationStore = useOrganizationStore()
const loading = ref(false)
const confirmationText = ref('')

const emit = defineEmits<{
    (e: 'close'): void
}>()

const handleDelete = async () => {
    if (!organizationStore.currentOrganization) return

    if (confirmationText.value !== organizationStore.currentOrganization.name) {
        return
    }

    loading.value = true

    try {
        await organizationStore.deleteOrganization(organizationStore.currentOrganization.id)
        emit('close')
        router.push('/organization/create')
    } catch (error) {
        console.error('Failed to delete organization:', error)
    } finally {
        loading.value = false
    }
}
</script>