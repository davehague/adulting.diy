// components/organization/MembersList.vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useOrganizationStore } from '@/stores/organization'
import type { OrganizationMember, OrganizationRole } from '@/types/organization'

const organizationStore = useOrganizationStore()

const isConfirmingRemoval = ref<string | null>(null)
const isEditingRole = ref<string | null>(null)
const selectedRole = ref<OrganizationRole | null>(null)

// Load members on mount
onMounted(async () => {
    await organizationStore.fetchMembers()
})

const startEditRole = (member: OrganizationMember) => {
    isEditingRole.value = member.id
    selectedRole.value = member.role
}

const cancelEditRole = () => {
    isEditingRole.value = null
    selectedRole.value = null
}

const updateRole = async (memberId: string) => {
    if (!selectedRole.value) return

    try {
        await organizationStore.updateMemberRole(memberId, selectedRole.value)
        cancelEditRole()
    } catch (error) {
        // Error is handled by the store
        cancelEditRole()
    }
}

const startRemoveMember = (memberId: string) => {
    isConfirmingRemoval.value = memberId
}

const cancelRemoveMember = () => {
    isConfirmingRemoval.value = null
}

const confirmRemoveMember = async (memberId: string) => {
    try {
        await organizationStore.removeMember(memberId)
        cancelRemoveMember()
    } catch (error) {
        // Error is handled by the store
        cancelRemoveMember()
    }
}
</script>

<template>
    <div class="space-y-4">
        <!-- Header -->
        <div class="flex justify-between items-center">
            <h2 class="text-xl font-semibold">Organization Members</h2>
            <span class="text-sm text-gray-600">
                {{ organizationStore.memberCount }} members
            </span>
        </div>

        <!-- Loading State -->
        <div v-if="organizationStore.loading" class="text-center py-4">
            <span class="text-gray-600">Loading members...</span>
        </div>

        <!-- Error State -->
        <div v-else-if="organizationStore.error" class="bg-red-50 text-red-600 p-4 rounded">
            {{ organizationStore.error }}
        </div>

        <!-- Members List -->
        <div v-else class="divide-y divide-gray-200">
            <div v-for="member in organizationStore.members" :key="member.id"
                class="py-4 flex items-center justify-between">
                <!-- Member Info -->
                <div class="flex items-center space-x-4">
                    <img v-if="member.user.picture" :src="member.user.picture" :alt="member.user.name"
                        class="h-10 w-10 rounded-full" />
                    <div v-else class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span class="text-gray-500 text-sm">
                            {{ member.user.name.charAt(0).toUpperCase() }}
                        </span>
                    </div>
                    <div>
                        <p class="font-medium">{{ member.user.name }}</p>
                        <p class="text-sm text-gray-500">{{ member.user.email }}</p>
                    </div>
                </div>

                <!-- Role Management -->
                <div class="flex items-center space-x-4">
                    <!-- Role Display/Edit -->
                    <div v-if="isEditingRole === member.id" class="flex items-center space-x-2">
                        <select v-model="selectedRole" class="rounded border-gray-300 text-sm">
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                        </select>
                        <button @click="updateRole(member.id)"
                            class="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                            Save
                        </button>
                        <button @click="cancelEditRole"
                            class="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                            Cancel
                        </button>
                    </div>
                    <div v-else>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" :class="{
                            'bg-blue-100 text-blue-800': member.role === 'admin',
                            'bg-green-100 text-green-800': member.role === 'member',
                            'bg-gray-100 text-gray-800': member.role === 'viewer'
                        }">
                            {{ member.role }}
                        </span>
                    </div>

                    <!-- Actions -->
                    <div v-if="organizationStore.isAdmin && !isEditingRole" class="flex items-center space-x-2">
                        <button @click="startEditRole(member)" class="text-sm text-gray-600 hover:text-gray-900">
                            Edit Role
                        </button>
                        <button v-if="isConfirmingRemoval === member.id" @click="confirmRemoveMember(member.id)"
                            class="text-sm text-red-600 hover:text-red-900">
                            Confirm Remove
                        </button>
                        <button v-else @click="startRemoveMember(member.id)"
                            class="text-sm text-red-600 hover:text-red-900">
                            Remove
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-if="organizationStore.members.length === 0 && !organizationStore.loading" class="text-center py-8">
            <p class="text-gray-500">No members found</p>
        </div>
    </div>
</template>