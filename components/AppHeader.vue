<template>
  <header class="container mx-auto px-6 py-4">
    <div class="flex justify-end items-center">
      <div v-if="isAuthenticated" class="flex items-center space-x-4">
        <img v-if="user?.picture" :src="user.picture" alt="Profile" class="w-8 h-8 rounded-full">
        <span>{{ user?.name }}</span>
        <NuxtLink to="/home">Home</NuxtLink>
        <button @click="logout" class="text-red-500 hover:text-red-700">Logout</button>
      </div>
      <NuxtLink v-else to="/login"
        class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-300">Login</NuxtLink>
    </div>
  </header>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const { user, isAuthenticated } = storeToRefs(authStore)
const router = useRouter()

const logout = () => {
  authStore.logout()
  router.push('/login')
}
</script>