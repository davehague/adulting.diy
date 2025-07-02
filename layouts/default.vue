<template>
  <div class="min-h-screen flex flex-col bg-gray-100">
    <!-- Development User Switcher -->
    <DevUserSwitcher />
    
    <!-- Header/Navbar -->
    <header class="bg-white shadow-sm" v-if="authStore.isAuthenticated">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <!-- Logo/Brand -->
            <div class="flex-shrink-0 flex items-center">
              <a href="/home" class="text-blue-600 font-bold text-xl">Adulting.DIY</a>
            </div>
            
            <!-- Navigation Links -->
            <nav class="hidden sm:ml-6 sm:flex sm:space-x-4">
              <a 
                href="/home" 
                class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2"
                :class="route.path === '/home' ? 'border-blue-500' : 'border-transparent hover:border-gray-300'"
              >
                Dashboard
              </a>
              
              <a 
                href="/tasks" 
                class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2"
                :class="route.path.startsWith('/tasks') ? 'border-blue-500' : 'border-transparent hover:border-gray-300'"
              >
                Tasks
              </a>
              
              <a 
                href="/occurrences" 
                class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2"
                :class="route.path.startsWith('/occurrences') ? 'border-blue-500' : 'border-transparent hover:border-gray-300'"
              >
                Occurrences
              </a>
              
              <a 
                href="/household" 
                class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2"
                :class="route.path === '/household' ? 'border-blue-500' : 'border-transparent hover:border-gray-300'"
              >
                Household
              </a>
            </nav>
          </div>
          
          <!-- User Dropdown -->
          <div class="flex items-center">
            <div class="relative">
              <button 
                @click="toggleUserMenu" 
                class="flex items-center text-sm rounded-full focus:outline-none"
              >
                <img 
                  v-if="authStore.user?.picture" 
                  :src="authStore.user.picture" 
                  alt="Profile" 
                  class="h-8 w-8 rounded-full"
                >
                <div 
                  v-else 
                  class="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white"
                >
                  {{ userInitials }}
                </div>
                <span class="ml-2 hidden md:block">{{ authStore.user?.name }}</span>
                <svg class="ml-1 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
              
              <!-- Dropdown Menu -->
              <div 
                v-show="showUserMenu"
                class="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 z-50"
              >
                <a 
                  href="/profile" 
                  class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  @click="showUserMenu = false"
                >
                  Your Profile
                </a>
                <button 
                  @click="logout" 
                  class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
    
    <!-- Main Content -->
    <main class="flex-grow">
      <slot />
    </main>
    
    <!-- Footer -->
    <footer class="bg-white py-4">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p class="text-center text-gray-500 text-sm">
          © {{ new Date().getFullYear() }} Adulting.DIY - Keep up with your home, your dog, and your life.
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// User dropdown menu
const showUserMenu = ref(false);

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value;
};

// Click outside handler (replacing the onClickOutside composable)
const handleClickOutside = (event: MouseEvent) => {
  const dropdown = document.querySelector('.relative');
  if (dropdown && !dropdown.contains(event.target as Node) && showUserMenu.value) {
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
