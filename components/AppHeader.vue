<template>
  <header class="container mx-auto px-6 py-4">
    <div class="flex justify-end items-center">
      <div v-if="isAuthenticated" class="flex items-center space-x-4">
        <img v-if="user?.picture" :src="user.picture" alt="Profile" class="w-8 h-8 rounded-full">
        <span>{{ user?.name }}</span>
        <NuxtLink to="/home">Home</NuxtLink>
        <button @click="logout" class="inline-flex items-center gap-1.5 text-red-500 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"><LogOut :size="16" />Logout</button>
      </div>
      <NuxtLink v-else to="/login"
        class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors"><LogIn :size="16" />Login</NuxtLink>
    </div>
  </header>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { LogIn, LogOut } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const { user, isAuthenticated } = storeToRefs(authStore)
const router = useRouter()

const logout = () => {
  authStore.logout()
  router.push('/login')
}
</script>