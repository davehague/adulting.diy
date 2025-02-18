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
        <template v-else>
            <div v-if="organizationStore.members && organizationStore.members.length > 0"
                class="divide-y divide-gray-200">
                <div v-for="member in organizationStore.members" :key="member?.id"
                    class="py-4 flex items-center justify-between">
                    <!-- Member Info -->
                    <div class="flex items-center space-x-4">
                        <img v-if="member?.user?.picture" :src="member.user.picture" :alt="member?.user?.name ?? 'User'"
                            class="h-10 w-10 rounded-full object-cover" />
                        <div v-else class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span class="text-gray-500 text-sm">
                                {{ member?.user?.name?.charAt(0)?.toUpperCase() ?? '?' }}
                            </span>
                        </div>
                        <div>
                            <p class="font-medium">{{ member?.user?.name }}</p>
                            <p class="text-sm text-gray-500">{{ member?.user?.email }}</p>
                        </div>
                    </div>

                    <!-- Role Display (all users can see roles) -->
                    <div class="flex items-center space-x-4">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            :class="getRoleStyles(member?.role)">
                            {{ member?.role }}
                        </span>

                        <!-- Admin-only Actions -->
                        <div v-if="organizationStore.isAdmin" class="flex items-center space-x-2">
                            <div v-if="editState.memberId === member?.id" class="flex items-center space-x-2">
                                <select v-model="editState.role" class="rounded border-gray-300 text-sm">
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
                            <template v-else>
                                <button @click="startEditRole(member)"
                                    class="text-sm text-gray-600 hover:text-gray-900">
                                    Edit Role
                                </button>
                                <button v-if="removalState === member?.id" @click="confirmRemoveMember(member.id)"
                                    class="text-sm text-red-600 hover:text-red-900">
                                    Confirm Remove
                                </button>
                                <button v-else @click="startRemoveMember(member.id)"
                                    class="text-sm text-red-600 hover:text-red-900">
                                    Remove
                                </button>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else class="text-center py-8">
                <p class="text-gray-500">No members found</p>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useOrganizationStore } from '@/stores/organization'
import { type OrganizationMember, type OrganizationRole } from '@/types/organization'

const organizationStore = useOrganizationStore()

interface EditState {
    memberId: string | null
    role: OrganizationRole | null
}

const editState = ref<EditState>({
    memberId: null,
    role: null
})

const removalState = ref<string | null>(null)

onMounted(async () => {
    if (!organizationStore.members || organizationStore.members.length === 0) {
        await organizationStore.fetchMembers()
    }
})

const startEditRole = (member: OrganizationMember) => {
    if (!member?.id || !member?.role) return

    editState.value = {
        memberId: member.id,
        role: member.role
    }
}

const cancelEditRole = () => {
    editState.value = {
        memberId: null,
        role: null
    }
}

const updateRole = async (memberId: string) => {
    if (!editState.value.role || !memberId) return

    try {
        await organizationStore.updateMemberRole(memberId, editState.value.role)
        cancelEditRole()
    } catch (error) {
        cancelEditRole()
    }
}

const startRemoveMember = (memberId: string) => {
    if (!memberId) return
    removalState.value = memberId
}

const cancelRemoveMember = () => {
    removalState.value = null
}

const confirmRemoveMember = async (memberId: string) => {
    if (!memberId) return

    try {
        await organizationStore.removeMember(memberId)
        cancelRemoveMember()
    } catch (error) {
        cancelRemoveMember()
    }
}

const getRoleStyles = (role?: OrganizationRole): string => {
    const styles = {
        admin: 'bg-blue-100 text-blue-800',
        member: 'bg-green-100 text-green-800',
        viewer: 'bg-gray-100 text-gray-800'
    }
    return role ? styles[role] : styles.viewer
}
</script>