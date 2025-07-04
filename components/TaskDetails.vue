<template>
  <div class="bg-white rounded-lg shadow-md">
    <div class="p-6 pb-4">
      <div class="flex justify-between items-start mb-4">
        <h2 
          class="text-xl font-semibold"
          :class="{ 'cursor-pointer hover:text-gray-700 transition-colors': collapsible }"
          @click="collapsible && (isExpanded = !isExpanded)"
        >
          Task Details
        </h2>
        <div class="flex items-center space-x-2">
          <span class="px-2 py-1 text-xs font-semibold rounded-full mr-2" :class="getStatusClass(task.metaStatus)">
            {{ formatStatus(task.metaStatus) }}
          </span>
          <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
            {{ getCategoryName(task.categoryId) }}
          </span>
          <button 
            v-if="collapsible"
            @click="isExpanded = !isExpanded"
            class="p-1 rounded-md hover:bg-gray-100 transition-colors"
            :title="isExpanded ? 'Collapse' : 'Expand'"
          >
            <svg 
              class="w-5 h-5 transition-transform duration-200" 
              :class="{ 'rotate-180': isExpanded }"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div v-if="!collapsible || isExpanded" class="px-6 pb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h3 class="text-lg font-medium mb-3">Task Information</h3>
        
        <div class="mb-4">
          <h4 class="text-sm font-medium text-gray-500 mb-1">Name</h4>
          <p class="text-gray-800 font-medium">{{ task.name }}</p>
        </div>

        <div v-if="task.description" class="mb-4">
          <h4 class="text-sm font-medium text-gray-500 mb-1">Description</h4>
          <p class="text-gray-800">{{ task.description }}</p>
        </div>

        <div v-if="task.instructions" class="mb-4">
          <h4 class="text-sm font-medium text-gray-500 mb-1">Instructions</h4>
          <p class="text-gray-800 whitespace-pre-line">{{ task.instructions }}</p>
        </div>

        <div class="mb-4">
          <h4 class="text-sm font-medium text-gray-500 mb-1">Default Assignees</h4>
          <p class="text-gray-800">
            {{ getDefaultAssigneeNames(task.defaultAssigneeIds) }}
          </p>
        </div>
      </div>

      <div>
        <h3 class="text-lg font-medium mb-3">Schedule & Configuration</h3>

        <div class="mb-4">
          <h4 class="text-sm font-medium text-gray-500 mb-1">Schedule Type</h4>
          <p class="text-gray-800">{{ formatSchedule(task.scheduleConfig) }}</p>
        </div>

        <div v-if="task.reminderConfig" class="mb-4">
          <h4 class="text-sm font-medium text-gray-500 mb-1">Reminders</h4>
          <ul class="list-disc pl-5 text-gray-800">
            <li v-if="task.reminderConfig.initialReminder">
              Initial: {{ task.reminderConfig.initialReminder }} days before due date
            </li>
            <li v-if="task.reminderConfig.followUpReminder">
              Follow-up: {{ task.reminderConfig.followUpReminder }} days before due date
            </li>
            <li v-if="task.reminderConfig.overdueReminder">
              Overdue: {{ task.reminderConfig.overdueReminder }} days after due date
            </li>
          </ul>
        </div>

        <div class="mb-4">
          <h4 class="text-sm font-medium text-gray-500 mb-1">Created</h4>
          <p class="text-gray-800">{{ formatDate(task.createdAt) }}</p>
        </div>

        <div class="mb-4">
          <h4 class="text-sm font-medium text-gray-500 mb-1">Last Updated</h4>
          <p class="text-gray-800">{{ formatDate(task.updatedAt) }}</p>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { TaskDefinition, Category, User } from '@/types';

interface Props {
  task: TaskDefinition;
  categories?: Category[];
  householdUsers?: User[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  categories: () => [],
  householdUsers: () => [],
  collapsible: false,
  defaultExpanded: true
});

const isExpanded = ref(props.defaultExpanded);

const getCategoryName = (categoryId: string): string => {
  const category = props.categories.find(c => c.id === categoryId);
  return category ? category.name : 'Unknown';
};

const formatDate = (date: Date | string): string => {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatStatus = (status: string | undefined | null): string => {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ');
};

const getStatusClass = (status: string): string => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800';
    case 'soft-deleted':
      return 'bg-red-100 text-red-800';
    case 'completed':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatSchedule = (scheduleConfig: any): string => {
  if (!scheduleConfig) return 'No schedule';

  switch (scheduleConfig.type) {
    case 'once':
      return 'One time';
    case 'fixed_interval':
      return `Every ${scheduleConfig.interval} ${scheduleConfig.intervalUnit}${scheduleConfig.interval > 1 ? 's' : ''}`;
    case 'specific_days_of_week':
      const days = Object.entries(scheduleConfig.daysOfWeek || {})
        .filter(([_, enabled]) => enabled)
        .map(([day]) => day.charAt(0).toUpperCase() + day.slice(1))
        .join(', ');
      return `Weekly on ${days}`;
    case 'specific_day_of_month':
      return `Monthly on day ${scheduleConfig.dayOfMonth}`;
    case 'specific_weekday_of_month':
      if (scheduleConfig.weekdayOfMonth) {
        const { occurrence, weekday } = scheduleConfig.weekdayOfMonth;
        return `${occurrence.charAt(0).toUpperCase() + occurrence.slice(1)} ${weekday.charAt(0).toUpperCase() + weekday.slice(1)} of each month`;
      }
      return 'Monthly';
    case 'variable_interval':
      if (scheduleConfig.variableInterval) {
        const { interval, unit } = scheduleConfig.variableInterval;
        return `${interval} ${unit}${interval > 1 ? 's' : ''} after completion`;
      }
      return 'Variable schedule';
    default:
      return 'Custom schedule';
  }
};

const getDefaultAssigneeNames = (assigneeIds: string[] | undefined): string => {
  if (!assigneeIds || assigneeIds.length === 0) {
    return 'No default assignees';
  }
  
  const names = assigneeIds
    .map(id => {
      const user = props.householdUsers.find(user => user.id === id);
      return user?.name;
    })
    .filter(name => !!name);

  return names.length > 0 ? names.join(', ') : 'Unknown User(s)';
};
</script>