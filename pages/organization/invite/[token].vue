<template>
    <div class="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div class="sm:mx-auto sm:w-full sm:max-w-md">
            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Organization Invitation
            </h2>
        </div>

        <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                <div v-if="loading" class="text-center">
                    <p class="text-gray-500">Verifying invitation...</p>
                </div>

                <div v-else-if="error" class="text-center">
                    <p class="text-red-600">{{ error }}</p>
                    <button @click="router.push('/home')"
                        class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                        Go to Home
                    </button>
                </div>

                <template v-else>
                    <div class="text-center">
                        <h3 class="text-lg font-medium text-gray-900">Join {{ inviteData?.organization?.name }}</h3>
                        <p class="mt-2 text-sm text-gray-500">
                            You've been invited to join as a {{ inviteData?.role }}
                        </p>
                    </div>

                    <div class="mt-6">
                        <button @click="acceptInvite" :disabled="accepting"
                            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
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

const router = useRouter()
const route = useRoute()
const organizationStore = useOrganizationStore()

const loading = ref(true)
const accepting = ref(false)
const error = ref<string | null>(null)
const inviteData = ref<any>(null)

onMounted(async () => {
    try {
        const token = route.params.token as string
        const { data } = await useFetch(`/api/organization/invite/verify`, {
            query: { token }
        })

        if (data.value) {
            inviteData.value = data.value
        }
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to verify invitation'
    } finally {
        loading.value = false
    }
})

const acceptInvite = async () => {
    accepting.value = true
    try {
        await useFetch('/api/organization/invite/accept', {
            method: 'POST',
            body: {
                token: route.params.token
            }
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