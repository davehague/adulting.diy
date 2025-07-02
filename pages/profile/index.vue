<template>
  <div class="container mx-auto px-4 py-8 max-w-2xl">
    <h1 class="text-2xl font-bold mb-6">Your Profile</h1>

    <div class="bg-white rounded-lg shadow-md overflow-hidden">
      <!-- Profile Header -->
      <div class="p-6 bg-blue-500 text-white">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <img v-if="authStore.user?.picture" :src="authStore.user.picture" alt="Profile"
              class="h-20 w-20 rounded-full border-4 border-white">
            <div v-else
              class="h-20 w-20 rounded-full bg-blue-700 flex items-center justify-center text-white text-2xl border-4 border-white">
              {{ userInitials }}
            </div>
          </div>
          <div class="ml-6">
            <h2 class="text-2xl font-bold">{{ authStore.user?.name || 'User' }}</h2>
            <p class="text-blue-100">{{ authStore.user?.email || 'No email' }}</p>
          </div>
        </div>
      </div>

      <!-- Profile Details -->
      <div class="p-6 space-y-6">
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Account Information</h3>
          <div class="bg-gray-50 rounded p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-gray-500">Name</p>
              <p class="text-gray-900">{{ authStore.user?.name || 'Not set' }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Email</p>
              <p class="text-gray-900">{{ authStore.user?.email || 'Not set' }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Account Created</p>
              <p class="text-gray-900">{{ formatDate(authStore.user?.createdAt) }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Last Login</p>
              <p class="text-gray-900">{{ formatDate(authStore.user?.lastLogin) }}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Household</h3>
          <div v-if="authStore.user?.householdId" class="bg-gray-50 rounded p-4">
            <p>
              You are currently a member of a household.
              <span v-if="authStore.user.isAdmin"
                class="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Admin</span>
            </p>
            <div class="mt-2">
              <NuxtLink to="/household" class="text-blue-600 hover:text-blue-800 text-sm">
                Manage Household Settings
              </NuxtLink>
            </div>
          </div>
          <div v-else class="bg-yellow-50 rounded p-4">
            <p class="text-yellow-800">You are not currently a member of any household.</p>
            <div class="mt-2">
              <NuxtLink to="/setup-household" class="text-blue-600 hover:text-blue-800 text-sm">
                Set Up or Join a Household
              </NuxtLink>
            </div>
          </div>
        </div>

        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Notification Preferences</h3>
          <NotificationPreferences />
        </div>

        <div class="pt-4 border-t border-gray-200">
          <NuxtLink to="/home" class="text-blue-600 hover:text-blue-800">
            &larr; Back to Dashboard
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
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

// Debug mode
const debugMode = ref(false);

// User initials for avatar
const userInitials = computed(() => {
  if (!authStore.user?.name) return '?';

  const nameParts = authStore.user.name.split(' ');
  if (nameParts.length > 1) {
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  }

  return nameParts[0][0].toUpperCase();
});

// Debug information
const debugInfo = computed(() => {
  return JSON.stringify(authStore.user, null, 2);
});

// Date formatting helper
const formatDate = (date: string | Date | undefined): string => {
  if (!date) return 'Unknown';

  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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
</script>
