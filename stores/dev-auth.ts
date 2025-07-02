import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { DevUser } from '@/server/utils/dev-auth';
import { useAuthStore } from '@/stores/auth';

export const useDevAuthStore = defineStore('dev-auth', () => {
  const config = useRuntimeConfig();
  const isEnabled = computed(() => config.public.devBypassEnabled);
  
  const availableUsers = ref<DevUser[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  
  const fetchUsers = async () => {
    if (!isEnabled.value) return;
    
    try {
      isLoading.value = true;
      error.value = null;
      console.log('[DEV STORE] 🧪 Fetching development users');
      
      const users = await $fetch<DevUser[]>('/api/dev/users');
      availableUsers.value = users;
      
      console.log(`[DEV STORE] ✅ Loaded ${users.length} development users`);
    } catch (err) {
      console.error('[DEV STORE] ❌ Failed to fetch dev users:', err);
      error.value = 'Failed to load development users';
      availableUsers.value = [];
    } finally {
      isLoading.value = false;
    }
  };
  
  const switchUser = async (userId: string) => {
    if (!isEnabled.value) return;
    
    try {
      isLoading.value = true;
      error.value = null;
      console.log(`[DEV STORE] 🧪 Switching to user: ${userId}`);
      
      const response = await $fetch('/api/dev/login', {
        method: 'POST',
        body: { userId }
      });
      
      if (response.success) {
        console.log(`[DEV STORE] ✅ Successfully switched to: ${response.user.email}`);
        
        // Update the auth store directly
        const authStore = useAuthStore();
        authStore.setUser(response.user);
        authStore.setAccessToken('dev-bypass-token'); // Fake token for dev mode
        
        // Force a page refresh to update middleware state
        window.location.reload();
      }
    } catch (err) {
      console.error('[DEV STORE] ❌ Failed to switch user:', err);
      error.value = 'Failed to switch user';
    } finally {
      isLoading.value = false;
    }
  };
  
  const logoutDev = async () => {
    if (!isEnabled.value) return;
    
    try {
      isLoading.value = true;
      error.value = null;
      console.log('[DEV STORE] 🧪 Logging out development user');
      
      await $fetch('/api/dev/logout', {
        method: 'POST'
      });
      
      console.log('[DEV STORE] ✅ Successfully logged out development user');
      
      // Clear the auth store
      const authStore = useAuthStore();
      authStore.logout();
      
      // Force a page refresh
      window.location.reload();
    } catch (err) {
      console.error('[DEV STORE] ❌ Failed to logout dev user:', err);
      error.value = 'Failed to logout';
    } finally {
      isLoading.value = false;
    }
  };
  
  return {
    isEnabled,
    availableUsers,
    isLoading,
    error,
    fetchUsers,
    switchUser,
    logoutDev
  };
});