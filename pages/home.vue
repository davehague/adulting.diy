<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p class="text-gray-600 mt-1">Welcome, {{ authStore.user?.name }}</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Quick Actions Card -->
      <div class="bg-white rounded-lg shadow-md overflow-hidden">
        <div class="px-6 py-4 bg-blue-500 text-white">
          <h2 class="font-bold text-lg">Quick Actions</h2>
        </div>
        <div class="p-6">
          <div class="space-y-4">
            <NuxtLink to="/tasks/create"
              class="block w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded text-center">
              Create New Task
            </NuxtLink>
            <NuxtLink to="/tasks"
              class="block w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-center">
              View All Tasks
            </NuxtLink>
            <button @click="logout"
              class="block w-full py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded text-center">
              Logout
            </button>
          </div>
        </div>
      </div>

      <!-- Household Info Card -->
      <div v-if="authStore.user?.householdId" class="bg-white rounded-lg shadow-md overflow-hidden">
        <!-- Use camelCase -->
        <div class="px-6 py-4 bg-green-500 text-white">
          <h2 class="font-bold text-lg">Your Household</h2>
        </div>
        <div class="p-6">
          <p class="text-gray-600 mb-4">
            You're part of a household
          </p>
          <NuxtLink to="/household"
            class="block w-full py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded text-center">
            Manage Household
          </NuxtLink>
        </div>
      </div>

      <!-- Getting Started Card -->
      <div v-else class="bg-white rounded-lg shadow-md overflow-hidden">
        <div class="px-6 py-4 bg-yellow-500 text-white">
          <h2 class="font-bold text-lg">Getting Started</h2>
        </div>
        <div class="p-6">
          <p class="text-gray-600 mb-4">
            You need to join or create a household to get started.
          </p>
          <NuxtLink to="/setup-household"
            class="block w-full py-2 px-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-center">
            Setup Household
          </NuxtLink>
        </div>
      </div>

      <!-- Upcoming Tasks Card -->
      <div class="bg-white rounded-lg shadow-md overflow-hidden">
        <div class="px-6 py-4 bg-purple-500 text-white">
          <h2 class="font-bold text-lg">Upcoming Tasks</h2>
        </div>
        <div class="p-6">
          <!-- Placeholder for upcoming tasks -->
          <p class="text-gray-600 text-center py-4">
            No upcoming tasks.
          </p>
          <NuxtLink to="/tasks"
            class="block w-full py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white rounded text-center">
            View All Tasks
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Debug section -->
    <div v-if="debugMode" class="mt-6 p-4 bg-gray-100 rounded-md">
      <h3 class="font-medium mb-2">Debug Info:</h3>
      <pre class="text-xs overflow-auto">{{ debugInfo }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

// Debug mode
const debugMode = ref(false);

// Debug information
const debugInfo = computed(() => {
  return JSON.stringify({
    user: authStore.user,
    isAuthenticated: authStore.isAuthenticated
  }, null, 2);
});

// Logout function
const logout = () => {
  authStore.logout();
  router.push('/login');
};

// Toggle debug mode with key press (Ctrl+D)
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      debugMode.value = !debugMode.value;
    }
  });
}

// Page metadata
definePageMeta({
  // middleware: 'auth' // Removed redundant named middleware
});
</script>
