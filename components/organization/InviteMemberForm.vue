<template>
    <div class="max-w-lg">
        <form @submit.prevent="handleSubmit" class="space-y-6">
            <div v-if="error" class="bg-red-50 text-red-500 p-4 rounded-md">
                {{ error }}
            </div>

            <div class="space-y-2">
                <label for="email" class="block text-sm font-medium text-gray-700">
                    Email Address
                </label>
                <input id="email" v-model="formData.email" type="email" required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter email address" :disabled="loading" />
            </div>

            <div class="space-y-2">
                <label for="role" class="block text-sm font-medium text-gray-700">
                    Member Role
                </label>
                <select id="role" v-model="formData.role" required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    :disabled="loading">
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                </select>
            </div>

            <div class="flex justify-end">
                <button type="submit" :disabled="loading"
                    class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span v-if="loading">Sending Invitation...</span>
                    <span v-else>Send Invitation</span>
                </button>
            </div>
        </form>
    </div>
</template>


<script setup lang="ts">
import { ref } from 'vue'
import { useOrganizationStore } from '@/stores/organization'
import type { CreateInviteDTO } from '@/types/organization'

const organizationStore = useOrganizationStore()

const emit = defineEmits<{
    (e: 'invited'): void
}>()

const loading = ref(false)
const error = ref<string | null>(null)

const formData = ref<CreateInviteDTO>({
    email: '',
    role: 'member'
})

const handleSubmit = async () => {
    if (!formData.value.email.trim()) {
        error.value = 'Email is required'
        return
    }

    loading.value = true
    error.value = null

    try {
        await organizationStore.inviteMember(formData.value)

        // Reset form
        formData.value = {
            email: '',
            role: 'member'
        }

        emit('invited')
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to send invitation'
    } finally {
        loading.value = false
    }
}
</script>