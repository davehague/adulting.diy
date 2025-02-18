// components/organization/OrgSettingsForm.vue
<template>
    <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Error alert -->
        <div v-if="error" class="bg-red-50 text-red-600 p-4 rounded-md">
            {{ error }}
        </div>

        <!-- Form fields -->
        <div class="space-y-4">
            <div>
                <label for="name" class="block text-sm font-medium text-gray-700">
                    Organization Name
                </label>
                <input id="name" v-model="formData.name" type="text" required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    :disabled="loading" />
            </div>

            <div>
                <label for="description" class="block text-sm font-medium text-gray-700">
                    Description
                </label>
                <textarea id="description" v-model="formData.description" rows="3"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    :disabled="loading" />
            </div>
        </div>

        <!-- Submit button -->
        <div class="flex justify-end">
            <button type="submit" :disabled="loading"
                class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
                {{ loading ? 'Saving...' : 'Save Changes' }}
            </button>
        </div>
    </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useOrganizationStore } from '@/stores/organization'

const organizationStore = useOrganizationStore()
const loading = ref(false)
const error = ref<string | null>(null)

const formData = ref({
    name: organizationStore.currentOrganization?.name ?? '',
    description: organizationStore.currentOrganization?.description ?? ''
})

const handleSubmit = async () => {
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
</script>