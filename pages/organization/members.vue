<template>
    <div class="space-y-8">
        <!-- Header Section -->
        <div class="sm:flex sm:items-center sm:justify-between">
            <div>
                <h2 class="text-2xl font-bold text-gray-900">Organization Members</h2>
                <p class="mt-1 text-sm text-gray-500">
                    Manage your household members and invitations
                </p>
            </div>
            <button @click="showInviteForm = true"
                class="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Invite Member
            </button>
        </div>

        <!-- Members List -->
        <div class="bg-white shadow rounded-lg overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Member
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Joined
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="member in members" :key="member.id">
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="flex items-center">
                                <img v-if="member.user.picture" :src="member.user.picture"
                                    class="h-8 w-8 rounded-full" />
                                <div class="ml-4">
                                    <div class="text-sm font-medium text-gray-900">{{ member.user.name }}</div>
                                    <div class="text-sm text-gray-500">{{ member.user.email }}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" :class="{
                                'bg-green-100 text-green-800': member.role === 'admin',
                                'bg-blue-100 text-blue-800': member.role === 'member',
                                'bg-gray-100 text-gray-800': member.role === 'viewer'
                            }">
                                {{ member.role }}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {{ new Date(member.joined_at).toLocaleDateString() }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button v-if="userRole === 'admin' && member.user.id !== currentUserId"
                                @click="openChangeRoleModal(member)" class="text-blue-600 hover:text-blue-900">
                                Change Role
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Pending Invites -->
        <div v-if="pendingInvites.length > 0" class="mt-8">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Pending Invitations</h3>
            <div class="bg-white shadow rounded-lg overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Email
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Role
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Expires
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr v-for="invite in pendingInvites" :key="invite.id">
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {{ invite.email }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" :class="{
                                    'bg-green-100 text-green-800': invite.role === 'admin',
                                    'bg-blue-100 text-blue-800': invite.role === 'member',
                                    'bg-gray-100 text-gray-800': invite.role === 'viewer'
                                }">
                                    {{ invite.role }}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {{ new Date(invite.expires_at).toLocaleDateString() }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <button @click="cancelInvite(invite.id)" class="text-red-600 hover:text-red-900">
                                    Cancel
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Invite Form Modal -->
        <Modal v-model="showInviteForm">
            <template #title>Invite New Member</template>
            <InviteMemberForm :organization-id="organizationId" @invited="handleInvited" />
        </Modal>

        <!-- Change Role Modal -->
        <Modal v-model="showChangeRoleModal">
            <template #title>Change Member Role</template>
            <div class="p-4">
                <select v-model="selectedRole"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                </select>
                <div class="mt-4 flex justify-end space-x-2">
                    <button @click="showChangeRoleModal = false"
                        class="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">
                        Cancel
                    </button>
                    <button @click="updateMemberRole"
                        class="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700">
                        Update Role
                    </button>
                </div>
            </div>
        </Modal>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useOrganizationStore } from '@/stores/organization'
import { useAuthStore } from '@/stores/auth'
import type { OrganizationMember, OrganizationInvite } from '~/types'

const organizationStore = useOrganizationStore()
const authStore = useAuthStore()

const organizationId = computed(() => organizationStore.currentOrganization?.id)
const userRole = computed(() => organizationStore.userRole)
const currentUserId = computed(() => authStore.user?.id)

const members = ref<OrganizationMember[]>([])
const pendingInvites = ref<OrganizationInvite[]>([])
const showInviteForm = ref(false)
const showChangeRoleModal = ref(false)
const selectedMember = ref<OrganizationMember | null>(null)
const selectedRole = ref<OrganizationMember['role']>('member')

const fetchMembers = async () => {
    const { data } = await useFetch<OrganizationMember[]>(
        `/api/organization/${organizationId.value}/members`
    )
    if (data.value) {
        members.value = data.value
    }
}

const fetchPendingInvites = async () => {
    const { data } = await useFetch<OrganizationInvite[]>(
        `/api/organization/${organizationId.value}/invites?status=pending`
    )
    if (data.value) {
        pendingInvites.value = data.value
    }
}

const handleInvited = () => {
    showInviteForm.value = false
    fetchPendingInvites()
}

const cancelInvite = async (inviteId: string) => {
    await useFetch(`/api/organization/invite/${inviteId}`, {
        method: 'DELETE'
    })
    await fetchPendingInvites()
}

const openChangeRoleModal = (member: OrganizationMember) => {
    selectedMember.value = member
    selectedRole.value = member.role
    showChangeRoleModal.value = true
}

const updateMemberRole = async () => {
    if (!selectedMember.value) return

    await useFetch(`/api/organization/${organizationId.value}/members/${selectedMember.value.id}`, {
        method: 'PATCH',
        body: {
            role: selectedRole.value
        }
    })

    showChangeRoleModal.value = false
    await fetchMembers()
}

onMounted(() => {
    fetchMembers()
    fetchPendingInvites()
})
</script>