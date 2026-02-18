<template>
  <div class="container mx-auto px-4 py-8 max-w-6xl">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="font-heading text-2xl font-bold text-stone-900">Dashboard</h1>
        <p class="text-stone-500 mt-1">{{ greeting }}, {{ authStore.user?.name?.split(' ')[0] }}</p>
      </div>
      <div class="flex gap-3">
        <NuxtLink to="/tasks/create"
          class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
          <Plus :size="16" /> New Task
        </NuxtLink>
      </div>
    </div>

    <!-- Skeleton Loading State -->
    <div v-if="loading">
      <!-- Stat Cards Skeleton -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div v-for="i in 3" :key="i" class="bg-white rounded-xl shadow-sm border border-stone-100 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="h-4 w-16 bg-stone-200 rounded animate-pulse"></div>
            <div class="w-8 h-8 rounded-full bg-stone-200 animate-pulse"></div>
          </div>
          <div class="h-9 w-12 bg-stone-200 rounded animate-pulse mb-2"></div>
          <div class="w-full bg-stone-100 rounded-full h-1.5">
            <div class="bg-stone-200 h-1.5 rounded-full w-1/3 animate-pulse"></div>
          </div>
        </div>
      </div>

      <!-- Coming Up Skeleton -->
      <div class="bg-white rounded-xl shadow-sm border border-stone-100 mb-8">
        <div class="px-6 py-4 border-b border-stone-100">
          <div class="h-5 w-24 bg-stone-200 rounded animate-pulse"></div>
        </div>
        <div class="divide-y divide-stone-50">
          <div v-for="i in 5" :key="i" class="flex items-center gap-4 px-6 py-3.5">
            <div class="w-2 h-2 rounded-full bg-stone-200 animate-pulse"></div>
            <div class="flex-1">
              <div class="h-4 w-48 bg-stone-200 rounded animate-pulse mb-1"></div>
              <div class="h-3 w-24 bg-stone-100 rounded animate-pulse"></div>
            </div>
            <div class="h-3 w-16 bg-stone-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>

      <!-- Bottom Row Skeleton -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div v-for="i in 2" :key="i" class="bg-white rounded-xl shadow-sm border border-stone-100">
          <div class="px-6 py-4 border-b border-stone-100">
            <div class="h-5 w-32 bg-stone-200 rounded animate-pulse"></div>
          </div>
          <div class="p-6 space-y-3">
            <div v-for="j in 4" :key="j" class="flex items-center gap-3">
              <div class="h-4 w-20 bg-stone-200 rounded animate-pulse"></div>
              <div class="flex-1 bg-stone-100 rounded-full h-2">
                <div class="bg-stone-200 h-2 rounded-full animate-pulse" :style="{ width: (70 - j * 15) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <!-- Stat Cards Row -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <!-- Overdue -->
        <NuxtLink to="/occurrences?status=pending" class="block bg-white rounded-xl shadow-sm border border-stone-100 p-5 hover:shadow-md transition-shadow">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-stone-500">Overdue</span>
            <span class="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 text-sm">!</span>
          </div>
          <div class="text-3xl font-bold" :class="overdueOccurrences.length > 0 ? 'text-red-600' : 'text-stone-300'">
            {{ overdueOccurrences.length }}
          </div>
          <div class="mt-2 w-full bg-stone-100 rounded-full h-1.5">
            <div class="bg-red-500 h-1.5 rounded-full transition-all" :style="{ width: overdueBarWidth }"></div>
          </div>
        </NuxtLink>

        <!-- Due Today -->
        <NuxtLink to="/occurrences?status=pending" class="block bg-white rounded-xl shadow-sm border border-stone-100 p-5 hover:shadow-md transition-shadow">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-stone-500">Due Today</span>
            <span class="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 text-sm">
              {{ todayFormatted }}
            </span>
          </div>
          <div class="text-3xl font-bold" :class="dueTodayOccurrences.length > 0 ? 'text-amber-700' : 'text-stone-300'">
            {{ dueTodayOccurrences.length }}
          </div>
          <div class="mt-2 w-full bg-stone-100 rounded-full h-1.5">
            <div class="bg-amber-600 h-1.5 rounded-full transition-all" :style="{ width: dueTodayBarWidth }"></div>
          </div>
        </NuxtLink>

        <!-- Completed (7d) -->
        <div class="bg-white rounded-xl shadow-sm border border-stone-100 p-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-stone-500">Completed (7d)</span>
            <span class="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-500 text-sm">&#10003;</span>
          </div>
          <div class="text-3xl font-bold" :class="recentlyCompletedCount > 0 ? 'text-green-600' : 'text-stone-300'">
            {{ recentlyCompletedCount }}
          </div>
          <div class="mt-2 w-full bg-stone-100 rounded-full h-1.5">
            <div class="bg-green-500 h-1.5 rounded-full transition-all" :style="{ width: completedBarWidth }"></div>
          </div>
        </div>
      </div>

      <!-- Coming Up -->
      <div class="bg-white rounded-xl shadow-sm border border-stone-100 mb-8">
        <div class="px-6 py-4 border-b border-stone-100">
          <h2 class="font-heading font-semibold text-stone-900">Coming Up</h2>
        </div>
        <div v-if="comingUp.length === 0" class="px-6 py-8 text-center text-stone-400">
          Nothing coming up — you're all clear!
        </div>
        <div v-else class="divide-y divide-stone-50">
          <NuxtLink v-for="occ in comingUp" :key="occ.id" :to="`/occurrences/${occ.id}`"
            class="flex items-center gap-4 px-6 py-3.5 hover:bg-stone-50 transition-colors">
            <span v-if="isOverdue(occ)" class="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Overdue"></span>
            <span v-else-if="isDueToday(occ)" class="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" title="Due today"></span>
            <span v-else class="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" title="Upcoming"></span>
            <div class="flex-1 min-w-0">
              <span class="text-sm font-medium text-stone-900 truncate block">{{ occ.task?.name || 'Unnamed task' }}</span>
              <span v-if="occ.task?.category" class="text-xs text-stone-400">{{ occ.task.category.name }}</span>
            </div>
            <div class="text-right flex-shrink-0">
              <span class="text-xs font-medium" :class="isOverdue(occ) ? 'text-red-500' : isDueToday(occ) ? 'text-amber-600' : 'text-blue-500'">
                {{ formatDueLabel(occ) }}
              </span>
            </div>
            <div class="text-xs text-stone-400 flex-shrink-0 hidden sm:block w-24 text-right truncate">
              {{ assigneeLabel(occ) }}
            </div>
          </NuxtLink>
        </div>
        <div v-if="comingUp.length > 0" class="px-6 py-3 border-t border-stone-100">
          <NuxtLink to="/occurrences?status=pending" class="text-sm text-amber-700 hover:text-amber-700 font-medium">
            View all occurrences &rarr;
          </NuxtLink>
        </div>
      </div>

      <!-- Bottom Row: By Category + Household -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- By Category -->
        <div class="bg-white rounded-xl shadow-sm border border-stone-100">
          <div class="px-6 py-4 border-b border-stone-100">
            <h2 class="font-heading font-semibold text-stone-900">By Category</h2>
          </div>
          <div v-if="categoryBreakdown.length === 0" class="px-6 py-8 text-center text-stone-400">
            No active tasks yet.
          </div>
          <div v-else class="p-6 space-y-3">
            <div v-for="cat in categoryBreakdown" :key="cat.name" class="flex items-center gap-3">
              <span class="text-sm text-stone-700 w-20 sm:w-28 truncate flex-shrink-0">{{ cat.name }}</span>
              <div class="flex-1 bg-stone-100 rounded-full h-2">
                <div class="h-2 rounded-full transition-all" :class="categoryBarColor(cat.index)" :style="{ width: categoryBarWidth(cat.count) }"></div>
              </div>
              <span class="text-sm font-medium text-stone-600 w-6 text-right flex-shrink-0">{{ cat.count }}</span>
            </div>
          </div>
          <div class="px-6 py-3 border-t border-stone-100">
            <NuxtLink to="/tasks" class="text-sm text-amber-700 hover:text-amber-700 font-medium">
              View all tasks &rarr;
            </NuxtLink>
          </div>
        </div>

        <!-- Household Members -->
        <div class="bg-white rounded-xl shadow-sm border border-stone-100">
          <div class="px-6 py-4 border-b border-stone-100">
            <h2 class="font-heading font-semibold text-stone-900">Household Members</h2>
          </div>
          <div v-if="!authStore.user?.householdId" class="px-6 py-8 text-center">
            <p class="text-stone-400 mb-4">You're not part of a household yet.</p>
            <NuxtLink to="/setup-household" class="text-sm text-amber-700 hover:text-amber-700 font-medium">
              Set up household &rarr;
            </NuxtLink>
          </div>
          <div v-else-if="householdMembers.length === 0" class="px-6 py-8 text-center text-stone-400">
            Loading members...
          </div>
          <div v-else class="divide-y divide-stone-50">
            <div v-for="member in memberStats" :key="member.id" class="flex items-center gap-3 px-6 py-3.5">
              <div class="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-sm font-medium text-stone-600 flex-shrink-0">
                {{ member.name?.charAt(0)?.toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <span class="text-sm font-medium text-stone-900 truncate block">{{ member.name }}</span>
              </div>
              <div class="text-right flex-shrink-0">
                <span class="text-sm text-stone-600">{{ member.dueCount }} due</span>
                <span v-if="member.overdueCount > 0" class="text-sm text-red-500 ml-2">{{ member.overdueCount }} late</span>
              </div>
            </div>
          </div>
          <div v-if="authStore.user?.householdId" class="px-6 py-3 border-t border-stone-100">
            <NuxtLink to="/household" class="text-sm text-amber-700 hover:text-amber-700 font-medium">
              Manage household &rarr;
            </NuxtLink>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useApi } from '@/utils/api';
import type { DashboardData } from '@/types/task';
import { Plus } from 'lucide-vue-next';

type PendingOccurrence = DashboardData['pendingOccurrences'][number];

const authStore = useAuthStore();
const api = useApi();

const loading = ref(true);
const dashboardData = ref<DashboardData | null>(null);

// Convenience computed refs
const pendingOccurrences = computed(() => dashboardData.value?.pendingOccurrences ?? []);
const recentlyCompletedCount = computed(() => dashboardData.value?.recentlyCompletedCount ?? 0);
const householdMembers = computed(() => dashboardData.value?.householdMembers ?? []);

// Greeting based on time of day
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
});

const todayFormatted = computed(() => {
  const d = new Date();
  return d.getDate().toString();
});

// Date helpers
const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const isOverdue = (occ: PendingOccurrence): boolean => {
  const due = new Date(occ.dueDate);
  return due < startOfDay(new Date());
};

const isDueToday = (occ: PendingOccurrence): boolean => {
  const due = new Date(occ.dueDate);
  const today = new Date();
  return due >= startOfDay(today) && due <= endOfDay(today);
};

// Derived data
const overdueOccurrences = computed(() =>
  pendingOccurrences.value.filter(isOverdue)
);

const dueTodayOccurrences = computed(() =>
  pendingOccurrences.value.filter(isDueToday)
);

const comingUp = computed(() => {
  // Server returns sorted by dueDate asc, just take first 5
  return pendingOccurrences.value.slice(0, 5);
});

// Bar widths for stat cards (relative to a reasonable max of ~20)
const barScale = (count: number) => Math.min(100, (count / 20) * 100) + '%';
const overdueBarWidth = computed(() => barScale(overdueOccurrences.value.length));
const dueTodayBarWidth = computed(() => barScale(dueTodayOccurrences.value.length));
const completedBarWidth = computed(() => barScale(recentlyCompletedCount.value));

// Category breakdown from server-aggregated data
const categoryBreakdown = computed(() => {
  if (!dashboardData.value) return [];
  return dashboardData.value.categoryBreakdown.map((cat, index) => ({
    ...cat,
    index,
  }));
});

const maxCategoryCount = computed(() =>
  Math.max(1, ...categoryBreakdown.value.map(c => c.count))
);

const categoryBarWidth = (count: number) =>
  Math.max(8, (count / maxCategoryCount.value) * 100) + '%';

const categoryColors = ['bg-amber-600', 'bg-purple-500', 'bg-amber-500', 'bg-teal-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500', 'bg-cyan-500'];
const categoryBarColor = (index: number) => categoryColors[index % categoryColors.length];

// Member stats - count due/overdue per member
const memberStats = computed(() => {
  return householdMembers.value.map(member => {
    const memberPending = pendingOccurrences.value.filter(
      occ => occ.assigneeIds?.includes(member.id)
    );
    const dueCount = memberPending.length;
    const overdueCount = memberPending.filter(isOverdue).length;
    return { ...member, dueCount, overdueCount };
  });
});

// Labels
const formatDueLabel = (occ: PendingOccurrence): string => {
  const due = new Date(occ.dueDate);
  const today = startOfDay(new Date());
  const diffMs = today.getTime() - startOfDay(due).getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return '1 day late';
  if (diffDays > 1) return `${diffDays}d late`;
  if (diffDays === -1) return 'Tomorrow';
  return `In ${Math.abs(diffDays)}d`;
};

const assigneeLabel = (occ: PendingOccurrence): string => {
  if (!occ.assigneeIds || occ.assigneeIds.length === 0) return 'Unassigned';
  const names = occ.assigneeIds.map(id => {
    const member = householdMembers.value.find(m => m.id === id);
    return member?.name?.split(' ')[0] || 'Unknown';
  });
  return names.join(', ');
};

// Data fetching - single optimized API call
const fetchDashboardData = async () => {
  loading.value = true;
  try {
    dashboardData.value = await api.get<DashboardData>('/api/dashboard');
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  watch(() => authStore.isReady, (ready) => {
    if (ready) fetchDashboardData();
  }, { immediate: true });
});
</script>
