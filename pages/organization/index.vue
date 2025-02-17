<template>
    <div class="min-h-screen bg-gray-100">
        <!-- Navigation Bar -->
        <nav class="bg-white shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <!-- Organization Info -->
                    <div class="flex items-center" v-if="organizationStore.currentOrganization">
                        <h1 class="text-lg font-semibold text-gray-900">
                            {{ organizationStore.currentOrganization.name }}
                        </h1>
                        <span v-if="organizationStore.userRole"
                            class="ml-4 px-2 py-1 text-sm text-gray-600 bg-gray-100 rounded-md">
                            {{ organizationStore.userRole }}
                        </span>
                    </div>

                    <!-- Navigation Links -->
                    <div class="flex items-center space-x-4" v-if="organizationStore.currentOrganization">
                        <RouterLink to="/organization/dashboard"
                            class="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                            active-class="text-blue-600">
                            Dashboard
                        </RouterLink>

                        <RouterLink to="/organization/members"
                            class="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                            active-class="text-blue-600">
                            Members
                        </RouterLink>

                        <RouterLink v-if="organizationStore.isAdmin"
                            :to="`/organization/${organizationStore.currentOrganization.id}/settings`"
                            class="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                            active-class="text-blue-600">
                            Settings
                        </RouterLink>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div v-if="organizationStore.loading" class="text-center py-12">
                <p class="text-gray-600">Loading organization data...</p>
            </div>
            <div v-else-if="organizationStore.error" class="bg-red-50 text-red-600 p-4 rounded-md">
                {{ organizationStore.error }}
            </div>
            <RouterView v-else />
        </main>
    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOrganizationStore } from '@/stores/organization'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const organizationStore = useOrganizationStore()

onMounted(async () => {
    // Verify authentication
    if (!authStore.isAuthenticated) {
        router.push('/login')
        return
    }

    // Load organization data if not already loaded
    if (!organizationStore.currentOrganization) {
        try {
            await organizationStore.fetchUserOrganization()

            // If still no organization after fetch, redirect to create
            if (!organizationStore.currentOrganization) {
                router.push('/organization/create')
            }
        } catch (error) {
            console.error('Failed to load organization:', error)
        }
    }
})
</script>