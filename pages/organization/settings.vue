<template>
    <div class="min-h-screen bg-gray-100">
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Non-admin users only see members list -->
            <div v-if="!organizationStore.isAdmin" class="bg-white shadow rounded-lg">
                <div class="p-6">
                    <MembersList />
                </div>
            </div>

            <!-- Admin-only sections -->
            <div v-else class="space-y-6">
                <!-- Organization Settings -->
                <div class="bg-white shadow rounded-lg">
                    <div class="p-6">
                        <h2 class="text-lg font-medium text-gray-900 mb-6">Organization Settings</h2>
                        <OrgSettingsForm />
                    </div>
                </div>

                <!-- Members Management -->
                <div class="bg-white shadow rounded-lg">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-lg font-medium text-gray-900">Members</h2>
                            <button @click="showInviteForm = true" class="text-sm text-blue-600 hover:text-blue-900">
                                Invite Member
                            </button>
                        </div>
                        <MembersList />
                    </div>
                </div>

                <!-- Danger Zone -->
                <div class="bg-white shadow rounded-lg">
                    <div class="p-6">
                        <h2 class="text-lg font-medium text-red-600">Danger Zone</h2>
                        <OrgDangerZone />
                    </div>
                </div>
            </div>

            <!-- Invite Modal (admin only) -->
            <InviteMemberModal v-if="showInviteForm && organizationStore.isAdmin" @close="showInviteForm = false" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useOrganizationStore } from '@/stores/organization'
import MembersList from '@/components/organization/MembersList.vue'
import InviteMemberModal from '@/components/organization/InviteMemberModal.vue'
import OrgSettingsForm from '@/components/organization/OrgSettingsForm.vue'
import OrgDangerZone from '@/components/organization/OrgDangerZone.vue'

const organizationStore = useOrganizationStore()
const showInviteForm = ref(false)
</script>