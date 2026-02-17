<template>
  <div class="min-h-screen bg-stone-50 text-stone-900">
    <!-- Hero Section -->
    <header class="container mx-auto px-6 py-20 text-center">
      <h1 class="font-heading text-xl md:text-2xl font-medium text-stone-600 mb-4">Your home. Your dog. Your life.</h1>
      <p class="font-heading text-5xl md:text-6xl font-bold text-stone-900 mb-12">Managed.</p>
      <a href="/login"
        class="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-8 rounded-full transition-colors duration-150 inline-block">
        Get Started
      </a>
    </header>

    <!-- Features Section -->
    <section id="features" class="container mx-auto px-6 py-12">
      <h2 class="font-heading text-3xl md:text-4xl font-semibold mb-12 text-center text-stone-900">Key Features</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="feature in features" :key="feature.title"
          class="bg-white rounded-xl p-6 shadow-sm border border-stone-200 hover:shadow-md transition-shadow duration-200">
          <component :is="feature.icon" class="h-12 w-12 mb-4 text-amber-600" />
          <h3 class="font-heading text-xl font-semibold mb-2 text-stone-900">{{ feature.title }}</h3>
          <p class="text-stone-500">{{ feature.description }}</p>
        </div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section id="how-it-works" class="container mx-auto px-6 py-16">
      <h2 class="font-heading text-3xl md:text-4xl font-semibold mb-12 text-center text-stone-900">How It Works</h2>
      <div class="flex flex-col md:flex-row items-center justify-center space-y-8 md:space-y-0 md:space-x-12">
        <div v-for="(step, index) in howItWorks" :key="step.title"
          class="flex flex-col items-center text-center max-w-xs">
          <div class="bg-amber-600 rounded-full w-16 h-16 flex items-center justify-center mb-4">
            <span class="text-2xl font-semibold text-white">{{ index + 1 }}</span>
          </div>
          <h3 class="font-heading text-xl font-semibold mb-2 text-stone-900">{{ step.title }}</h3>
          <p class="text-stone-500">{{ step.description }}</p>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="bg-amber-600 py-16">
      <div class="container mx-auto px-6 text-center">
        <h2 class="font-heading text-3xl md:text-4xl font-bold mb-6 text-white">Ready to streamline your home?</h2>
        <p class="text-xl mb-8 text-amber-100">Sign up now and start managing tasks like a pro</p>
        <a href="/login"
          class="bg-white text-amber-700 hover:bg-stone-50 font-semibold py-3 px-8 rounded-full transition-colors duration-150 inline-block">
          Get Started
        </a>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'landing'
})

import { CheckCircleIcon, ClockIcon, UsersIcon, TagIcon, BellIcon, LayersIcon } from 'lucide-vue-next'

const features = [
  {
    icon: CheckCircleIcon,
    title: 'Single Tasks',
    description: 'Track what needs to be done at home'
  },
  {
    icon: ClockIcon,
    title: 'Recurring Tasks',
    description: 'Easily set up and manage recurring tasks with flexible schedules.'
  },
  {
    icon: TagIcon,
    title: 'Custom Categories',
    description: 'Organize tasks with custom categories tailored to your needs.'
  },
  {
    icon: LayersIcon,
    title: 'Task Dependencies',
    description: 'Create and manage dependencies between non-recurring tasks.'
  },
  {
    icon: BellIcon,
    title: 'Flexible Notifications',
    description: 'Stay on top of upcoming and overdue tasks with customizable alerts.'
  },
  {
    icon: UsersIcon,
    title: 'Household Collaboration',
    description: 'Work together efficiently with role-based access and sharing.'
  }
]

const howItWorks = [
  {
    title: 'Sign Up',
    description: 'Create an account for your household and invite members.'
  },
  {
    title: 'Customize',
    description: 'Set up custom categories and notification preferences.'
  },
  {
    title: 'Manage Tasks',
    description: 'Add, assign, and track tasks for your household.'
  }
]
</script>
