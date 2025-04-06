<template>
  <div class="container mx-auto px-4 py-8 max-w-lg">

    <h1 class="text-2xl font-bold mb-6 text-center">Set Up Your Household</h1>

    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="mb-6">
        <h2 class="text-xl font-semibold mb-4">Welcome to Adulting.DIY!</h2>
        <p class="text-gray-700 mb-4">
          To get started, you need to either create a new household or join an existing one.
        </p>
      </div>

      <div class="flex gap-4 mb-6">
        <button @click="activeTab = 'create'" class="flex-1 py-2 rounded-md text-center font-medium"
          :class="activeTab === 'create' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'">
          Create New
        </button>
        <button @click="activeTab = 'join'" class="flex-1 py-2 rounded-md text-center font-medium"
          :class="activeTab === 'join' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'">
          Join Existing
        </button>
      </div>

      <!-- Create New Household Form -->
      <div v-if="activeTab === 'create'" class="mt-6">
        <form @submit.prevent="createHousehold">
          <div class="mb-4">
            <label for="householdName" class="block text-sm font-medium text-gray-700 mb-1">Household Name</label>
            <input id="householdName" v-model="createForm.name" type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter a name for your household" required />
          </div>

          <div class="flex justify-end">
            <button type="submit"
              class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              :disabled="isLoading">
              <span v-if="isLoading">Creating...</span>
              <span v-else>Create Household</span>
            </button>
          </div>
        </form>
      </div>

      <!-- Join Existing Household Form -->
      <div v-if="activeTab === 'join'" class="mt-6">
        <form @submit.prevent="joinHousehold">
          <div class="mb-4">
            <label for="inviteCode" class="block text-sm font-medium text-gray-700 mb-1">Invite Code</label>
            <input id="inviteCode" v-model="joinForm.inviteCode" type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your invite code" required />
          </div>

          <div class="flex justify-end">
            <button type="submit"
              class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              :disabled="isLoading">
              <span v-if="isLoading">Joining...</span>
              <span v-else>Join Household</span>
            </button>
          </div>
        </form>
      </div>

      <!-- Error message -->
      <div v-if="errorMessage" class="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
        {{ errorMessage }}
      </div>


      <!-- Debug section -->
      <div v-if="debugMode" class="mt-6 p-4 bg-gray-100 rounded-md">
        <h3 class="font-medium mb-2">Debug Info:</h3>
        <pre class="text-xs overflow-auto">{{ debugInfo }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

// State
const activeTab = ref<'create' | 'join'>('create');
const isLoading = ref(false);
const errorMessage = ref('');
const debugMode = ref(false);
const debugResponseData = ref<any>(null);

// Only run client-side code in the browser
const isClient = typeof window !== 'undefined';


// Form state
const createForm = ref({
  name: ''
});

const joinForm = ref({
  inviteCode: ''
});

// Debug information
const debugInfo = computed(() => {
  return JSON.stringify({
    user: authStore.user,
    createForm: createForm.value,
    joinForm: joinForm.value,
    responseData: debugResponseData.value,
    isClient: isClient
  }, null, 2);
});

// Create a new household
const createHousehold = async () => {
  if (!createForm.value.name.trim()) {
    errorMessage.value = 'Please enter a household name';
    return;
  }

  try {
    isLoading.value = true;
    errorMessage.value = '';

    // Use native fetch for debugging purposes
    const response = await fetch('/api/household/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.accessToken}`
      },
      body: JSON.stringify({
        name: createForm.value.name.trim()
      })
    });

    const data = await response.json();
    debugResponseData.value = data;

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create household');
    }

    // Refresh user data to get updated household info
    const userResponse = await fetch(`/api/user/profile?email=${encodeURIComponent(authStore.user?.email || '')}`, {
      headers: {
        'Authorization': `Bearer ${authStore.accessToken}`
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to update user profile');
    }

    const userData = await userResponse.json();
    authStore.setUser(userData);

    // Redirect to home/dashboard using router
    router.push('/home');

  } catch (error: unknown) { // Explicitly type error as unknown
    console.error('Error creating household:', error);
    // Type check before accessing .message
    if (error instanceof Error) {
      errorMessage.value = error.message;
    } else {
      errorMessage.value = 'An unexpected error occurred. Please try again.';
    }
  } finally {
    isLoading.value = false;
  }
};

// Join an existing household
const joinHousehold = async () => {
  if (!joinForm.value.inviteCode.trim()) {
    errorMessage.value = 'Please enter an invite code';
    return;
  }

  try {
    isLoading.value = true;
    errorMessage.value = '';

    // Use native fetch for debugging purposes
    const response = await fetch('/api/household/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.accessToken}`
      },
      body: JSON.stringify({
        inviteCode: joinForm.value.inviteCode.trim()
      })
    });

    const data = await response.json();
    debugResponseData.value = data;

    if (!response.ok) {
      throw new Error(data.message || 'Failed to join household');
    }

    // Refresh user data to get updated household info
    const userResponse = await fetch(`/api/user/profile?email=${encodeURIComponent(authStore.user?.email || '')}`, {
      headers: {
        'Authorization': `Bearer ${authStore.accessToken}`
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to update user profile');
    }

    const userData = await userResponse.json();
    authStore.setUser(userData);

    // Redirect to home/dashboard using router
    router.push('/home');

  } catch (error: unknown) { // Explicitly type error as unknown
    console.error('Error joining household:', error);
    // Type check before accessing .message
    if (error instanceof Error) {
      errorMessage.value = error.message;
    } else {
      errorMessage.value = 'An unexpected error occurred. Please try again.';
    }
  } finally {
    isLoading.value = false;
  }
};

// Toggle debug mode with key press (Ctrl+D)
if (isClient) {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      debugMode.value = !debugMode.value;
    }
  });
}

// Page metadata
definePageMeta({
});
</script>