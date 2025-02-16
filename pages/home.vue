// pages/home.vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useOrganizationStore } from '@/stores/organization'
import { type Organization } from '@/types/organization'
import CreateOrgForm from '@/components/organization/CreateOrgForm.vue'
import InviteMemberForm from '@/components/organization/InviteMemberForm.vue'
import MembersList from '@/components/organization/MembersList.vue'

const router = useRouter()
const authStore = useAuthStore()
const organizationStore = useOrganizationStore()

const pageLoading = ref(true)
const pageError = ref<string | null>(null)

const handleLogout = async () => {
  try {
    await authStore.logout()
    router.push('/')
  } catch (error) {
    pageError.value = 'Failed to logout. Please try again.'
  }
}

const handleOrgCreated = async () => {
  try {
    pageLoading.value = true
    await organizationStore.fetchUserOrganization()
  } catch (error) {
    pageError.value = 'Failed to refresh organization data.'
  } finally {
    pageLoading.value = false
  }
}

const navigateToSettings = () => {
  if (!organizationStore.currentOrganization?.id) return
  router.push(`/organization/${organizationStore.currentOrganization.id}/settings`)
}

const navigateToMembers = () => {
  router.push('/organization/members')
}

onMounted(async () => {
  try {
    await organizationStore.fetchUserOrganization()
  } catch (error) {
    pageError.value = 'Failed to load organization data.'
  } finally {
    pageLoading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <!-- Header Section -->
    <header class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex justify-between items-center">
          <div class="flex items-center space-x-4">
            <img v-if="authStore.user?.picture" :src="authStore.user.picture"
              :alt="authStore.user?.name ?? 'User avatar'" class="w-10 h-10 rounded-full object-cover">
            <div v-else
              class="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
              {{ authStore.user?.name?.charAt(0)?.toUpperCase() ?? '?' }}
            </div>
            <div>
              <h1 class="text-xl font-semibold">
                Welcome{{ authStore.user?.name ? `, ${authStore.user.name}` : '' }}!
              </h1>
              <p v-if="authStore.user?.email" class="text-sm text-gray-600">
                {{ authStore.user.email }}
              </p>
            </div>
          </div>
          <button @click="handleLogout"
            class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
            Logout
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Page Loading State -->
      <div v-if="pageLoading" class="text-center py-12">
        <p class="text-gray-600">Loading your dashboard...</p>
      </div>

      <!-- Page Error State -->
      <div v-else-if="pageError" class="max-w-2xl mx-auto bg-red-50 text-red-600 p-4 rounded-md">
        {{ pageError }}
      </div>

      <!-- Main Content -->
      <template v-else>
        <!-- Organization Loading State -->
        <div v-if="organizationStore.loading" class="text-center py-12">
          <p class="text-gray-600">Loading organization data...</p>
        </div>

        <!-- Organization Error State -->
        <div v-else-if="organizationStore.error" class="bg-red-50 text-red-600 p-4 rounded-md">
          {{ organizationStore.error }}
        </div>

        <!-- No Organization State -->
        <div v-else-if="!organizationStore.currentOrganization" class="max-w-2xl mx-auto">
          <div class="bg-white rounded-lg shadow-sm p-6">
            <h2 class="text-xl font-semibold mb-4">Get Started</h2>
            <p class="text-gray-600 mb-6">
              Create a new organization to start managing your household tasks.
            </p>
            <CreateOrgForm @created="handleOrgCreated" />
          </div>
        </div>

        <!-- Organization Dashboard -->
        <div v-else class="space-y-8">
          <!-- Organization Header -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex justify-between items-start">
              <div>
                <h2 class="text-2xl font-bold">
                  {{ organizationStore.currentOrganization.name }}
                </h2>
                <p v-if="organizationStore.currentOrganization.description" class="text-gray-600 mt-1">
                  {{ organizationStore.currentOrganization.description }}
                </p>
                <p v-if="organizationStore.userRole" class="text-sm text-gray-500 mt-2">
                  Your role: {{ organizationStore.userRole }}
                </p>
              </div>

              <!-- Admin Actions -->
              <div v-if="organizationStore.isAdmin" class="flex space-x-4">
                <button class="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md"
                  @click="navigateToSettings">
                  Organization Settings
                </button>
              </div>
            </div>
          </div>

          <!-- Members Section -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="space-y-6">
              <div class="flex justify-between items-center">
                <h3 class="text-lg font-semibold">Members</h3>
                <button v-if="organizationStore.isAdmin"
                  class="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md"
                  @click="navigateToMembers">
                  Manage Members
                </button>
              </div>

              <!-- Members List -->
              <MembersList />

              <!-- Invite Form -->
              <div v-if="organizationStore.isAdmin" class="mt-8 pt-8 border-t border-gray-200">
                <h4 class="text-lg font-semibold mb-4">Invite New Member</h4>
                <InviteMemberForm />
              </div>
            </div>
          </div>

          <!-- Tasks Preview Section -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <h3 class="text-lg font-semibold mb-4">Recent Tasks</h3>
            <p class="text-gray-600">Task management coming soon...</p>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>