<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Occurrences</h1>
      <p class="text-gray-600 mt-1">Manage all task occurrences across your household</p>
    </div>
    
    <!-- Placeholder content - to be implemented -->
    <div class="bg-white rounded-lg shadow-md p-8 text-center">
      <h2 class="text-xl font-semibold text-gray-700 mb-2">Coming Soon!</h2>
      <p class="text-gray-500 mb-4">
        This page is under development. Check back soon for a complete list of all task occurrences.
      </p>
      <NuxtLink 
        to="/tasks" 
        class="inline-block bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
      >
        Go to Tasks
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
// Page metadata
definePageMeta({
  middleware: 'auth'
});
</script>
