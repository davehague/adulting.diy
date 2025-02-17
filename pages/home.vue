<template>
  <div class="min-h-screen bg-gray-100">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div v-if="loading" class="text-center py-12">
        <p class="text-gray-600">Loading...</p>
      </div>
      <div v-else-if="error" class="max-w-2xl mx-auto bg-red-50 text-red-600 p-4 rounded-md">
        {{ error }}
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useOrganizationStore } from '@/stores/organization'

const router = useRouter()
const authStore = useAuthStore()
const organizationStore = useOrganizationStore()

const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    if (!authStore.isAuthenticated) {
      router.push('/login')
      return
    }

    // Check if user has an organization
    await organizationStore.fetchUserOrganization()

    if (organizationStore.currentOrganization) {
      router.push('/organization/dashboard')
    } else {
      router.push('/organization/create')
    }
  } catch (err) {
    error.value = 'Failed to load user data. Please try again.'
  } finally {
    loading.value = false
  }
})
</script>