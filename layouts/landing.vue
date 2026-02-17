<template>
  <div class="min-h-screen bg-stone-50">
    <!-- Development User Switcher -->
    <DevUserSwitcher />

    <header class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div class="flex justify-center">
        <h1 class="font-heading text-3xl font-semibold">
          <span class="text-stone-900">Adulting</span><span class="text-amber-600">.DIY</span>
        </h1>
      </div>
    </header>

    <main>
      <slot />
    </main>

    <footer class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <p class="text-center text-stone-500 text-sm">
        © {{ new Date().getFullYear() }} Adulting.DIY - Keep up with your home, your dog, and your life.
      </p>
    </footer>
  </div>
</template>
