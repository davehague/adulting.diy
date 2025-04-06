<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
    <!-- Hero Section -->
    <header class="container mx-auto px-6 py-16 text-center">
      <h1 class="text-xl md:text-2xl font-bold mb-6">Your home. Your dog. Your life.</h1>
      <h1 class="text-5xl md:text-6xl font-bold mb-12">Managed.</h1>
      <a href="/login"
        class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full transition duration-300 inline-block">Get
        Started</a>
    </header>

    <!-- Features Section -->
    <section id="features" class="container mx-auto px-6 py-8">
      <h2 class="text-3xl md:text-4xl font-bold mb-12 text-center">Key Features</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div v-for="feature in features" :key="feature.title" class="bg-gray-800 rounded-lg p-6 shadow-lg">
          <component :is="feature.icon" class="h-12 w-12 mb-4 text-blue-400" />
          <h3 class="text-xl font-semibold mb-2">{{ feature.title }}</h3>
          <p class="text-gray-400">{{ feature.description }}</p>
        </div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section id="how-it-works" class="container mx-auto px-6 py-16">
      <h2 class="text-3xl md:text-4xl font-bold mb-12 text-center">How It Works</h2>
      <div class="flex flex-col md:flex-row items-center justify-center space-y-8 md:space-y-0 md:space-x-12">
        <div v-for="(step, index) in howItWorks" :key="step.title"
          class="flex flex-col items-center text-center max-w-xs">
          <div class="bg-blue-600 rounded-full w-16 h-16 flex items-center justify-center mb-4">
            <span class="text-2xl font-bold">{{ index + 1 }}</span>
          </div>
          <h3 class="text-xl font-semibold mb-2">{{ step.title }}</h3>
          <p class="text-gray-400">{{ step.description }}</p>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="bg-blue-600 py-16">
      <div class="container mx-auto px-6 text-center">
        <h2 class="text-3xl md:text-4xl font-bold mb-6">Ready to streamline your home maintenance?</h2>
        <p class="text-xl mb-8">Sign up now and start managing tasks like a pro</p>
        <a href="/login"
          class="bg-white text-blue-600 hover:bg-gray-100 font-bold py-3 px-8 rounded-full transition duration-300 inline-block">Get
          Started</a>
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
    title: 'Team Collaboration',
    description: 'Work together efficiently with role-based access and sharing.'
  }
]

const howItWorks = [
  {
    title: 'Sign Up',
    description: 'Create an account for your household and invite team members.'
  },
  {
    title: 'Customize',
    description: 'Set up custom categories and notification preferences.'
  },
  {
    title: 'Manage Tasks',
    description: 'Add, assign, and track tasks for your team or yourself.'
  }
]
</script>
