<template>
    <div class="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div class="sm:mx-auto sm:w-full sm:max-w-md">
            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Organization Invitation
            </h2>
        </div>

        <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                <!-- Loading State -->
                <div v-if="loading" class="text-center">
                    <p class="text-gray-500">Verifying invitation...</p>
                </div>

                <!-- Error State -->
                <div v-else-if="error" class="text-center">
                    <p class="text-red-600">{{ error }}</p>
                    <button @click="router.push('/home')"
                        class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                        Go to Home
                    </button>
                </div>

                <!-- Invite Details -->
                <template v-else-if="inviteData">
                    <div class="text-center">
                        <h3 class="text-lg font-medium text-gray-900">
                            Join {{ inviteData.organization.name }}
                        </h3>
                        <p class="mt-2 text-sm text-gray-500">
                            You've been invited to join as a {{ inviteData.role }}
                        </p>
                        <p class="mt-1 text-sm text-gray-500">
                            Invitation sent to: {{ inviteData.email }}
                        </p>
                    </div>

                    <div class="mt-6">
                        <button @click="acceptInvite" :disabled="accepting"
                            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
                            {{ accepting ? 'Accepting...' : 'Accept Invitation' }}
                        </button>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useOrganizationStore } from '@/stores/organization'
import { useApi } from '@/utils/api'
import type { Organization, OrganizationRole } from '@/types/organization'

interface InviteData {
    organization: Organization
    role: OrganizationRole
    email: string
}

const router = useRouter()
const route = useRoute()
const api = useApi()
const organizationStore = useOrganizationStore()

const loading = ref(true)
const accepting = ref(false)
const error = ref<string | null>(null)
const inviteData = ref<InviteData | null>(null)

onMounted(async () => {
    try {
        const token = route.params.token as string
        const data = await api.get<InviteData>('/api/organization/invite/verify', {
            params: { token }
        })
        inviteData.value = data
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to verify invitation'
    } finally {
        loading.value = false
    }
})

const acceptInvite = async () => {
    accepting.value = true
    try {
        await api.post('/api/organization/invite/accept', {
            token: route.params.token
        })

        // Refresh organization data
        await organizationStore.fetchUserOrganization()

        // Redirect to organization home
        router.push('/home')
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to accept invitation'
    } finally {
        accepting.value = false
    }
}
</script>
