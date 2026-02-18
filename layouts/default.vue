<template>
  <div class="min-h-screen flex flex-col bg-stone-50">
    <!-- Development User Switcher -->
    <DevUserSwitcher />

    <!-- Header/Navbar -->
    <header class="bg-white shadow-sm border-b border-stone-200" v-if="authStore.isAuthenticated">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <!-- Logo/Brand -->
            <div class="flex-shrink-0 flex items-center">
              <a href="/dashboard" class="font-heading text-xl font-semibold">
                <span class="text-stone-900">Adulting</span><span class="text-amber-600">.DIY</span>
              </a>
            </div>

            <!-- Navigation Links -->
            <nav class="hidden sm:ml-6 sm:flex sm:space-x-4">
              <a
                href="/dashboard"
                class="inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors duration-150"
                :class="route.path === '/dashboard' ? 'border-amber-500 text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900 hover:border-stone-300'"
              >
                Dashboard
              </a>

              <a
                href="/tasks"
                class="inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors duration-150"
                :class="route.path.startsWith('/tasks') ? 'border-amber-500 text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900 hover:border-stone-300'"
              >
                Tasks
              </a>

              <a
                href="/occurrences"
                class="inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors duration-150"
                :class="route.path.startsWith('/occurrences') ? 'border-amber-500 text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900 hover:border-stone-300'"
              >
                Occurrences
              </a>

              <a
                v-if="authStore.user?.isAdmin"
                href="/household"
                class="inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors duration-150"
                :class="route.path === '/household' ? 'border-amber-500 text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900 hover:border-stone-300'"
              >
                Household
              </a>
            </nav>
          </div>

          <!-- Mobile menu button + User Dropdown -->
          <div class="flex items-center">
            <button
              @click="showMobileMenu = !showMobileMenu"
              class="sm:hidden inline-flex items-center justify-center p-2 rounded-md text-stone-500 hover:text-stone-700 hover:bg-stone-100 mr-2"
            >
              <svg v-if="!showMobileMenu" class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <svg v-else class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div ref="userMenuRef" class="relative">
              <button
                @click="toggleUserMenu"
                class="flex items-center text-sm rounded-full focus:outline-none transition-colors duration-150"
              >
                <img
                  v-if="authStore.user?.picture"
                  :src="authStore.user.picture"
                  alt="Profile"
                  class="h-8 w-8 rounded-full"
                >
                <div
                  v-else
                  class="h-8 w-8 rounded-full bg-amber-600 flex items-center justify-center text-white"
                >
                  {{ userInitials }}
                </div>
                <span class="ml-2 hidden md:block text-stone-700">{{ authStore.user?.name }}</span>
                <svg class="ml-1 h-5 w-5 text-stone-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>

              <!-- Dropdown Menu -->
              <div
                v-show="showUserMenu"
                class="absolute right-0 mt-2 w-48 rounded-lg shadow-md py-1 bg-white ring-1 ring-black ring-opacity-5 z-50"
              >
                <a
                  href="/profile"
                  class="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors duration-150"
                  @click="showUserMenu = false"
                >
                  Your Profile
                </a>
                <button
                  @click="logout"
                  class="block w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors duration-150"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Mobile Navigation Menu -->
    <div v-if="showMobileMenu && authStore.isAuthenticated" class="sm:hidden bg-white border-b border-stone-200 shadow-sm">
      <div class="px-4 py-3 space-y-1">
        <a
          href="/dashboard"
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-150"
          :class="route.path === '/dashboard' ? 'bg-amber-50 text-amber-700' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'"
          @click="showMobileMenu = false"
        >
          Dashboard
        </a>
        <a
          href="/tasks"
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-150"
          :class="route.path.startsWith('/tasks') ? 'bg-amber-50 text-amber-700' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'"
          @click="showMobileMenu = false"
        >
          Tasks
        </a>
        <a
          href="/occurrences"
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-150"
          :class="route.path.startsWith('/occurrences') ? 'bg-amber-50 text-amber-700' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'"
          @click="showMobileMenu = false"
        >
          Occurrences
        </a>
        <a
          v-if="authStore.user?.isAdmin"
          href="/household"
          class="block px-3 py-2 rounded-md text-base font-medium transition-colors duration-150"
          :class="route.path === '/household' ? 'bg-amber-50 text-amber-700' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'"
          @click="showMobileMenu = false"
        >
          Household
        </a>
      </div>
    </div>

    <!-- Main Content -->
    <main class="flex-grow">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-stone-200 py-4">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p class="text-center text-stone-500 text-sm">
          © {{ new Date().getFullYear() }} Adulting.DIY - Keep up with your home, your dog, and your life.
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// Mobile menu
const showMobileMenu = ref(false);

// User dropdown menu
const showUserMenu = ref(false);
const userMenuRef = ref<HTMLElement | null>(null);

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value;
};

// Close mobile menu on route change
watch(() => route.path, () => {
  showMobileMenu.value = false;
});

// Click outside handler (replacing the onClickOutside composable)
const handleClickOutside = (event: MouseEvent) => {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target as Node) && showUserMenu.value) {
    showUserMenu.value = false;
  }
};

// Set up and clean up event listeners
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Logout function
const logout = () => {
  authStore.logout();
  window.location.href = '/login';
};

// Compute user initials for avatar fallback
const userInitials = computed(() => {
  if (!authStore.user?.name) return '?';

  const nameParts = authStore.user.name.split(' ');
  if (nameParts.length > 1) {
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  }

  return nameParts[0][0].toUpperCase();
});
</script>
