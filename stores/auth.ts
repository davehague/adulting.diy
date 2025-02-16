import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { User } from "~/types";

export const useAuthStore = defineStore(
  "auth",
  () => {
    const user = ref<User | null>(null);
    const accessToken = ref<string | null>(null);

    const isAuthenticated = computed(() => !!user.value && !!accessToken.value);

    function setUser(newUser: User) {
      user.value = newUser;
    }

    function setAccessToken(token: string) {
      accessToken.value = token;
    }

    function logout() {
      user.value = null;
      accessToken.value = null;
    }

    return {
      user,
      accessToken,
      isAuthenticated,
      setUser,
      setAccessToken,
      logout,
    };
  },
  {
    persist: true,
  } as any
);
