<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex flex-wrap justify-between items-center gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-stone-900 font-heading">Projects</h1>
        <p class="text-stone-600 mt-1">Things to fix, improve or build around the house</p>
      </div>
      <NuxtLink to="/projects/new"
                class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors">
        <Plus :size="16" />New project
      </NuxtLink>
    </div>

    <!-- Toolbar -->
    <div class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 mb-6 flex flex-wrap items-center gap-4">
      <select v-model="path"
              aria-label="Path"
              class="rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm">
        <option value="">All paths</option>
        <option value="diy">DIY</option>
        <option value="hire">Hire</option>
        <option value="unsure">Not sure</option>
        <option value="none">Needs details</option>
      </select>
      <label class="inline-flex items-center gap-2 text-sm text-stone-700">
        <input v-model="showAll" type="checkbox" class="rounded border-stone-300 text-amber-600 focus:ring-amber-500">
        Show future and done
      </label>
    </div>

    <!-- Error State -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">
      {{ error }}
    </div>

    <!-- Loading State -->
    <div v-else-if="loading && projects.length === 0" class="text-center py-8">
      <p class="text-stone-600">Loading projects...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="projects.length === 0"
         class="bg-white rounded-xl shadow-sm border border-stone-200 p-8 text-center">
      <p class="text-stone-700">
        {{ hasActiveFilter ? 'No projects match these filters.' : 'No projects yet. Capture the first one.' }}
      </p>
      <NuxtLink v-if="!hasActiveFilter" to="/projects/new"
                class="inline-flex items-center gap-1.5 mt-4 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors">
        <Plus :size="16" />New project
      </NuxtLink>
    </div>

    <!-- List -->
    <ul v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <li v-for="project in projects" :key="project.id">
        <NuxtLink :to="`/projects/${project.id}`"
                  class="block bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden hover:border-amber-400 transition-colors">
          <div class="aspect-[4/3] bg-stone-100 relative">
            <PhotoCarousel v-if="project.photoCount > 1"
                           :project-id="project.id"
                           :photo-ids="project.photoIds"
                           variant="thumb"
                           :alt="project.title"
                           @update:current-index="(index) => setCardPhotoIndex(project.id, index)" />
            <AuthedImage v-else-if="project.coverPhotoId"
                         :project-id="project.id"
                         :photo-id="project.coverPhotoId"
                         variant="thumb"
                         :alt="project.title" />
            <div v-else class="w-full h-full flex items-center justify-center">
              <img src="/android-chrome-192x192.png" alt="" class="w-20 h-20 opacity-40">
            </div>

            <!-- Indicator dots: display only, never tappable, so a swipe or tap over them still
                 behaves like a swipe or tap on the card. -->
            <div v-if="project.photoCount > 1"
                 class="absolute inset-x-0 bottom-0 flex justify-center gap-1.5 py-2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none">
              <span v-for="(photoId, index) in project.photoIds"
                    :key="photoId"
                    class="w-1.5 h-1.5 rounded-full"
                    :class="(cardPhotoIndex[project.id] ?? 0) === index ? 'bg-white' : 'bg-white/50'" />
            </div>
          </div>
          <div class="p-4">
            <h2 class="font-medium text-stone-900 break-words">{{ project.title }}</h2>
            <p v-if="project.location" class="text-sm text-stone-600 mt-0.5">{{ project.location }}</p>
            <div class="flex flex-wrap items-center gap-2 mt-3">
              <span class="text-xs font-medium px-2 py-0.5 rounded-full" :class="statusBadgeClass(project.status)">
                {{ STATUS_LABELS[project.status] }}
              </span>
              <span v-if="project.path" class="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                {{ PATH_LABELS[project.path] }}
              </span>
              <span v-else class="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Needs details
              </span>
              <span v-if="project.photoCount > 1" class="text-xs text-stone-500">{{ project.photoCount }} photos</span>
            </div>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { Plus } from 'lucide-vue-next';
import {
  PROJECT_STATUSES,
  type ProjectListItem,
  type ProjectPathFilter,
  type ProjectStatus,
} from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import { PATH_LABELS, STATUS_LABELS, statusBadgeClass } from '@/utils/project-labels';
import AuthedImage from '@/components/projects/AuthedImage.vue';
import PhotoCarousel from '@/components/projects/PhotoCarousel.vue';

const { listProjects } = useProjects();

const projects = ref<ProjectListItem[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const path = ref<ProjectPathFilter | ''>('');
const showAll = ref(false);
const hasActiveFilter = computed(() => path.value !== '' || showAll.value);

// Which slide is in view for each multi-photo card's carousel, keyed by project id, for the dots.
const cardPhotoIndex = reactive<Record<string, number>>({});
const setCardPhotoIndex = (projectId: string, index: number): void => {
  cardPhotoIndex[projectId] = index;
};

// Ignore a slow response that arrives after a newer filter change.
let latestRequestId = 0;

const loadProjects = async (): Promise<void> => {
  const requestId = ++latestRequestId;
  loading.value = true;
  try {
    const statuses: ProjectStatus[] | undefined = showAll.value ? [...PROJECT_STATUSES] : undefined;
    const result = await listProjects({ statuses, path: path.value || undefined });
    if (requestId !== latestRequestId) return;
    projects.value = result;
    error.value = null;
  } catch (e) {
    if (requestId !== latestRequestId) return;
    error.value = e instanceof Error ? e.message : 'Failed to load projects';
  } finally {
    if (requestId === latestRequestId) loading.value = false;
  }
};

watch([path, showAll], loadProjects);
onMounted(loadProjects);
</script>
