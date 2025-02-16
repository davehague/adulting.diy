// components/organization/OrganizationInvites.vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useOrganizationStore } from '@/stores/organization'
import { useApi } from '@/utils/api'
import type { OrganizationInvite } from '@/types/organization'

const api = useApi()
const organizationStore = useOrganizationStore()
const loading = ref(false)
const error = ref<string | null>(null)
const resendingInvite = ref<string | null>(null)

onMounted(async () => {
    await organizationStore.fetchPendingInvites()
})

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
}

const resendInvite = async (invite: OrganizationInvite) => {
    resendingInvite.value = invite.id
    error.value = null

    try {
        await api.post(`/api/organization/${organizationStore.currentOrganization?.id}/invites`, {
            email: invite.email,
            role: invite.role
        })
        await organizationStore.fetchPendingInvites()
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to resend invite'
    } finally {
        resendingInvite.value = null
    }
}

const cancelInvite = async (inviteId: string) => {
    try {
        await organizationStore.cancelInvite(inviteId)
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to cancel invite'
    }
}
</script>

<template>
    <div class="space-y-4">
        <!-- Header -->
        <div class="flex justify-between items-center">
            <h3 class="text-lg font-medium">Pending Invitations</h3>
            <span class="text-sm text-gray-500">
                {{ organizationStore.pendingInvites.length }} pending
            </span>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="bg-red-50 text-red-600 p-4 rounded-md">
            {{ error }}
        </div>

        <!-- Loading State -->
        <div v-if="organizationStore.loading" class="text-center py-4">
            <p class="text-gray-500">Loading invites...</p>
        </div>

        <!-- Invites List -->
        <div v-else-if="organizationStore.pendingInvites.length > 0"
            class="bg-white shadow overflow-hidden sm:rounded-md">
            <ul class="divide-y divide-gray-200">
                <li v-for="invite in organizationStore.pendingInvites" :key="invite.id" class="px-4 py-4">
                    <div class="flex items-center justify-between">
                        <!-- Invite Info -->
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center space-x-3">
                                <div class="flex-shrink-0">
                                    <div class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                        <span class="text-gray-500 text-sm">
                                            {{ invite.email.charAt(0).toUpperCase() }}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-gray-900">{{ invite.email }}</p>
                                    <div class="flex items-center space-x-2">
                                        <span class="text-sm text-gray-500">Role: {{ invite.role }}</span>
                                        <span class="text-sm text-gray-500">•</span>
                                        <span class="text-sm text-gray-500">
                                            Expires: {{ formatDate(invite.expires_at) }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Status and Actions -->
                        <div class="flex items-center space-x-4">
                            <!-- Status Badge -->
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                :class="{
                                    'bg-yellow-100 text-yellow-800': invite.status === 'pending' && !isExpired(invite.expires_at),
                                    'bg-red-100 text-red-800': isExpired(invite.expires_at),
                                    'bg-green-100 text-green-800': invite.status === 'accepted'
                                }">
                                {{ isExpired(invite.expires_at) ? 'Expired' : invite.status }}
                            </span>

                            <!-- Action Buttons -->
                            <div class="flex space-x-2">
                                <button v-if="invite.status === 'pending'" @click="resendInvite(invite)"
                                    :disabled="resendingInvite === invite.id"
                                    class="text-sm text-blue-600 hover:text-blue-900 disabled:opacity-50">
                                    {{ resendingInvite === invite.id ? 'Resending...' : 'Resend' }}
                                </button>
                                <button @click="cancelInvite(invite.id)"
                                    class="text-sm text-red-600 hover:text-red-900">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </li>
            </ul>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-6 bg-white shadow sm:rounded-md">
            <p class="text-sm text-gray-500">No pending invitations</p>
        </div>
    </div>
</template>