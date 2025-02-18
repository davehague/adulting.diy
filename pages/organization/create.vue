<template>
    <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-lg mx-auto">
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900">Create Your Organization</h1>
                <p class="mt-2 text-sm text-gray-600">
                    Set up your household to start managing tasks together
                </p>
            </div>

            <CreateOrgForm @created="handleOrgCreated" />

            <p class="mt-8 text-center text-sm text-gray-500">
                This will be your household's shared space for managing tasks and coordinating together.
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import CreateOrgForm from '~/components/organization/CreateOrgForm.vue';

definePageMeta({
    layout: 'landing'
})

const router = useRouter()

const handleOrgCreated = async () => {
    // Navigate to home page after successful creation
    await router.push('/home')
}
</script>