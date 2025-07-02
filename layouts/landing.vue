<template>
  <div class="min-h-screen bg-gradient-to-b from-blue-50 to-white">
    <!-- Development User Switcher -->
    <DevUserSwitcher />
    
    <header class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div class="flex justify-center">
        <h1 class="text-3xl font-bold text-blue-600">Adulting.DIY</h1>
      </div>
    </header>
    
    <main>
      <slot />
    </main>
    
    <footer class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <p class="text-center text-gray-500 text-sm">
        © {{ new Date().getFullYear() }} Adulting.DIY - Keep up with your home, your dog, and your life.
      </p>
    </footer>
  </div>
</template>
