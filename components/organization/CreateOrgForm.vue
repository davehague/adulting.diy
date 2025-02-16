<template>
    <form @submit.prevent="handleSubmit" class="max-w-lg mx-auto space-y-6">
        <div v-if="error" class="bg-red-50 text-red-500 p-4 rounded-md mb-4">
            {{ error }}
        </div>

        <div class="space-y-2">
            <label for="orgName" class="block text-sm font-medium text-gray-700">
                Organization Name
            </label>
            <input id="orgName" v-model="formData.name" type="text" required
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter your organization name" :disabled="loading" />
        </div>

        <div class="space-y-2">
            <label for="description" class="block text-sm font-medium text-gray-700">
                Description (Optional)
            </label>
            <textarea id="description" v-model="formData.description" rows="3"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Describe your organization" :disabled="loading" />
        </div>

        <div class="flex justify-end">
            <button type="submit" :disabled="loading"
                class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                <span v-if="loading">Creating...</span>
                <span v-else>Create Organization</span>
            </button>
        </div>
    </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { CreateOrganizationDTO } from '~/types'
import { useOrganizationStore } from '@/stores/organization'

const organizationStore = useOrganizationStore()
const loading = ref(false)
const error = ref<string | null>(null)

const formData = ref<CreateOrganizationDTO>({
    name: '',
    description: ''
})

const emit = defineEmits<{
    (e: 'created', orgId: string): void
}>()

const handleSubmit = async () => {
    if (!formData.value.name.trim()) {
        error.value = 'Organization name is required'
        return
    }

    loading.value = true
    error.value = null

    try {
        const result = await organizationStore.createOrganization(formData.value) as { id: string }
        emit('created', result.id)
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to create organization'
    } finally {
        loading.value = false
    }
}
</script>
