<template>
    <div class="divide-y divide-gray-200">
        <div v-if="tasks.length === 0" class="p-4 text-center text-gray-500">
            No tasks found
        </div>

        <div v-for="task in tasks" :key="task.id" class="p-4 hover:bg-gray-50">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-lg font-medium text-gray-900">{{ task.title }}</h3>
                    <p v-if="task.description" class="mt-1 text-sm text-gray-600">
                        {{ task.description }}
                    </p>
                    <p v-if="task.current_occurrence" class="mt-1 text-sm text-gray-500">
                        Due: {{ new Date(task.current_occurrence.due_date).toLocaleDateString() }}
                    </p>
                </div>
                <div class="flex items-center space-x-2">
                    <button @click="$emit('edit', task, task.current_occurrence)"
                        class="text-gray-400 hover:text-gray-500">
                        Edit
                    </button>
                    <button @click="$emit('delete', task.id)" class="text-red-400 hover:text-red-500">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { type Task, type TaskOccurrence } from '@/types/tasks'

defineProps<{
    tasks: (Task & { current_occurrence?: TaskOccurrence })[]
}>()

defineEmits<{
    edit: [task: Task & { current_occurrence?: TaskOccurrence }, occurrence?: TaskOccurrence]
    delete: [id: string]
}>()
</script>