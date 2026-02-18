<template>
  <div class="bg-white rounded-xl shadow-sm border border-stone-200">
    <div class="p-6 pb-4">
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-4">
        <h2
          class="text-xl font-semibold font-heading"
          :class="{ 'cursor-pointer hover:text-stone-700 transition-colors': collapsible }"
          @click="collapsible && (isExpanded = !isExpanded)"
        >
          Task Details
        </h2>
        <div class="flex items-center space-x-2">
          <span class="px-2 py-1 text-xs font-semibold rounded-full mr-2" :class="getStatusClass(task.metaStatus)">
            {{ formatStatus(task.metaStatus) }}
          </span>
          <span class="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
            {{ getCategoryName(task.categoryId) }}
          </span>
          <div class="relative" ref="menuRef">
            <button
              @click="toggleMenu"
              class="p-1 rounded-md hover:bg-stone-100 transition-colors"
              title="Task actions"
            >
              <EllipsisVertical :size="20" class="text-stone-500" />
            </button>
            <div
              v-if="showMenu"
              class="absolute right-0 mt-1 w-44 rounded-lg bg-white shadow-lg ring-1 ring-stone-200 z-20"
            >
              <NuxtLink
                :to="`/tasks/${task.id}`"
                class="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 rounded-t-lg"
                @click="showMenu = false"
              >
                <Eye :size="16" class="text-stone-400" />
                View Task
              </NuxtLink>
              <NuxtLink
                :to="`/tasks/${task.id}/edit`"
                class="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 rounded-b-lg"
                @click="showMenu = false"
              >
                <Pencil :size="16" class="text-stone-400" />
                Edit Task
              </NuxtLink>
            </div>
          </div>
          <button
            v-if="collapsible"
            @click="isExpanded = !isExpanded"
            class="p-1 rounded-md hover:bg-stone-100 transition-colors"
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
        <h3 class="text-lg font-medium mb-3 font-heading">Task Information</h3>
        
        <div class="mb-4">
          <h4 class="text-sm font-medium text-stone-500 mb-1">Name</h4>
          <p class="text-stone-800 font-medium">{{ task.name }}</p>
        </div>

        <div v-if="task.description" class="mb-4">
          <h4 class="text-sm font-medium text-stone-500 mb-1">Description</h4>
          <p class="text-stone-800">{{ task.description }}</p>
        </div>

        <div v-if="task.instructions" class="mb-4">
          <h4 class="text-sm font-medium text-stone-500 mb-1">Instructions</h4>
          <p class="text-stone-800 whitespace-pre-line">{{ task.instructions }}</p>
        </div>

        <div class="mb-4">
          <h4 class="text-sm font-medium text-stone-500 mb-1">Default Assignees</h4>
          <p class="text-stone-800">
            <template v-if="getDefaultAssigneeNames(task.defaultAssigneeIds).length === 0">
              No default assignees
            </template>
            <template v-for="(assignee, idx) in getDefaultAssigneeNames(task.defaultAssigneeIds)" :key="idx">
              <span :class="assignee.departed ? 'text-stone-400 italic' : ''">{{ assignee.name }}</span><span v-if="idx < getDefaultAssigneeNames(task.defaultAssigneeIds).length - 1">, </span>
            </template>
          </p>
        </div>
      </div>

      <div>
        <h3 class="text-lg font-medium mb-3 font-heading">Schedule & Configuration</h3>

        <div class="mb-4">
          <h4 class="text-sm font-medium text-stone-500 mb-1">Schedule Type</h4>
          <p class="text-stone-800">{{ formatSchedule(task.scheduleConfig) }}</p>
        </div>

        <div v-if="task.reminderConfig" class="mb-4">
          <h4 class="text-sm font-medium text-stone-500 mb-1">Reminders</h4>
          <ul v-if="task.reminderConfig.reminders?.length" class="list-disc pl-5 text-stone-800">
            <li v-for="(reminder, index) in task.reminderConfig.reminders" :key="index">
              <template v-if="reminder.timing === 'on'">On due date</template>
              <template v-else-if="reminder.timing === 'before'">{{ reminder.days }} day{{ reminder.days !== 1 ? 's' : '' }} before due date</template>
              <template v-else>{{ reminder.days }} day{{ reminder.days !== 1 ? 's' : '' }} after due date</template>
            </li>
          </ul>
          <p v-else class="text-stone-400 text-sm">No reminders configured</p>
        </div>

        <div class="mb-4">
          <h4 class="text-sm font-medium text-stone-500 mb-1">Created</h4>
          <p class="text-stone-800">{{ formatDate(task.createdAt) }}</p>
        </div>

        <div class="mb-4">
          <h4 class="text-sm font-medium text-stone-500 mb-1">Last Updated</h4>
          <p class="text-stone-800">{{ formatDate(task.updatedAt) }}</p>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import type { TaskDefinition, Category, User } from '@/types';
import type { FormerHouseholdMember } from '@/types/user';
import { EllipsisVertical, Eye, Pencil } from 'lucide-vue-next';

interface Props {
  task: TaskDefinition;
  categories?: Category[];
  householdUsers?: User[];
  formerMembers?: FormerHouseholdMember[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  categories: () => [],
  householdUsers: () => [],
  formerMembers: () => [],
  collapsible: false,
  defaultExpanded: true
});

const isExpanded = ref(props.defaultExpanded);
const showMenu = ref(false);
const menuRef = ref<HTMLElement | null>(null);

const toggleMenu = (event: MouseEvent) => {
  event.stopPropagation();
  showMenu.value = !showMenu.value;
};

const closeMenu = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    showMenu.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', closeMenu);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenu);
});

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
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-stone-100 text-stone-800';
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
    case 'annual_fixed': {
      const monthNames = ['January','February','March','April','May','June',
        'July','August','September','October','November','December'];
      return `Annually on ${monthNames[(scheduleConfig.month || 1) - 1]} ${scheduleConfig.dayOfMonth}`;
    }
    case 'annual_variable': {
      const monthNames = ['January','February','March','April','May','June',
        'July','August','September','October','November','December'];
      return `~Annually around ${monthNames[(scheduleConfig.month || 1) - 1]} ${scheduleConfig.dayOfMonth}`;
    }
    default:
      return 'Custom schedule';
  }
};

const getDefaultAssigneeNames = (assigneeIds: string[] | undefined): { name: string; departed: boolean }[] => {
  if (!assigneeIds || assigneeIds.length === 0) return [];
  return assigneeIds.map(id => {
    const active = props.householdUsers.find(user => user.id === id);
    if (active) return { name: active.name, departed: false };
    const former = props.formerMembers.find(u => u.userId === id);
    if (former) return { name: former.name, departed: true };
    return { name: 'Unknown User', departed: false };
  });
};
</script>