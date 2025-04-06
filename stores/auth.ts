import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { User } from "~/types";

export const useAuthStore = defineStore(
  "auth",
  () => {
    const user = ref<User | null>(null);
    const accessToken = ref<string | null>(null);
    const isReady = ref(false); // Flag to indicate store is initialized

    const isAuthenticated = computed(() => !!user.value && !!accessToken.value);
    const currentUser = computed(() => user.value); // Keep currentUser if used elsewhere

    function setUser(newUser: User | null) {
      // Allow setting null on logout
      user.value = newUser;
    }

    function setAccessToken(token: string | null) {
      // Allow setting null on logout
      accessToken.value = token;
    }

    function logout() {
      setUser(null);
      setAccessToken(null);
      // Note: isReady should remain true after initialization
    }

    function markReady() {
      // Action to mark store as ready
      isReady.value = true;
    }

    return {
      user,
      accessToken,
      isReady, // Expose the flag
      isAuthenticated,
      currentUser,
      setUser,
      setAccessToken,
      logout,
      markReady, // Expose the action
    };
  },
  {
    persist: true, // Configuration for persisted state
  }
);
