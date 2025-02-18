<template>
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div class="flex justify-between items-start mb-4">
                <h2 class="text-lg font-medium text-gray-900">Invite New Member</h2>
                <button @click="emit('close')" class="text-gray-400 hover:text-gray-500">
                    <span class="sr-only">Close</span>
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <InviteMemberForm @invited="handleInvited" />
        </div>
    </div>
</template>

<script setup lang="ts">
import InviteMemberForm from './InviteMemberForm.vue'

const emit = defineEmits<{
    (e: 'close'): void
}>()

const handleInvited = () => {
    emit('close')
}
</script>