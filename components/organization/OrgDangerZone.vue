// components/organization/OrgDangerZone.vue
<template>
    <div>
        <p class="mt-1 text-sm text-gray-500">
            Once you delete an organization, there is no going back. Please be certain.
        </p>
        <button @click="showDeleteModal = true"
            class="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
            Delete Organization
        </button>

        <DeleteOrgModal v-if="showDeleteModal" @close="showDeleteModal = false" />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import DeleteOrgModal from '../organization/DeleteOrgModal.vue';

const showDeleteModal = ref(false)
</script>