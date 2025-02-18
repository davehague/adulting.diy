// components/organization/OrgNavigation.vue
<template>
    <nav v-if="organizationStore.currentOrganization" class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex items-center">
                    <h1 class="text-lg font-semibold text-gray-900">
                        {{ organizationStore.currentOrganization.name }}
                    </h1>
                </div>
                <div class="flex items-center space-x-4">
                    <button v-if="organizationStore.isAdmin" @click="router.push(`/organization/settings`)"
                        class="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
                        Settings
                    </button>
                </div>
            </div>
        </div>
    </nav>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useOrganizationStore } from '@/stores/organization'

const router = useRouter()
const organizationStore = useOrganizationStore()
</script>