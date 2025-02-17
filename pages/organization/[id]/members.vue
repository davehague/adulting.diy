<template>
    <div class="space-y-6">
        <!-- Header -->
        <div class="bg-white shadow rounded-lg">
            <div class="p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">Organization Members</h1>
                        <p class="mt-1 text-sm text-gray-500">
                            Manage members and their roles within your organization
                        </p>
                    </div>
                    <button v-if="organizationStore.isAdmin" @click="showInviteForm = true"
                        class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Invite Member
                    </button>
                </div>
            </div>
        </div>

        <!-- Members List -->
        <div class="bg-white shadow rounded-lg">
            <div class="p-6">
                <MembersList />
            </div>
        </div>

        <!-- Pending Invites Section -->
        <div v-if="organizationStore.isAdmin" class="bg-white shadow rounded-lg">
            <div class="p-6">
                <OrganizationInvites />
            </div>
        </div>

        <!-- Invite Form Modal -->
        <div v-if="showInviteForm"
            class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div class="flex justify-between items-start mb-4">
                    <h2 class="text-lg font-medium text-gray-900">Invite New Member</h2>
                    <button @click="showInviteForm = false" class="text-gray-400 hover:text-gray-500">
                        <span class="sr-only">Close</span>
                        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <InviteMemberForm @invited="handleInvited" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useOrganizationStore } from '@/stores/organization'
import MembersList from '@/components/organization/MembersList.vue'
import OrganizationInvites from '@/components/organization/OrganizationInvites.vue'
import InviteMemberForm from '@/components/organization/InviteMemberForm.vue'

const organizationStore = useOrganizationStore()
const showInviteForm = ref(false)

onMounted(async () => {
    // Fetch members if not already loaded
    if (!organizationStore.members || organizationStore.members.length === 0) {
        await organizationStore.fetchMembers()
    }

    // Fetch pending invites if admin
    if (organizationStore.isAdmin) {
        await organizationStore.fetchPendingInvites()
    }
})

const handleInvited = () => {
    showInviteForm.value = false
    // Refresh the invites list
    if (organizationStore.isAdmin) {
        organizationStore.fetchPendingInvites()
    }
}
</script>