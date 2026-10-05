<template>
  <div class="container mx-auto px-4 py-8 max-w-3xl">
    <NuxtLink to="/projects" class="text-sm text-amber-700 hover:text-amber-800">&larr; All projects</NuxtLink>

    <div v-if="loadError" class="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
      {{ loadError }}
    </div>
    <p v-else-if="!project" class="mt-4 text-stone-600">Loading project...</p>

    <div v-else class="mt-4 space-y-6">
      <!-- Details -->
      <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6 space-y-4">
        <div>
          <label for="project-title" class="block text-sm font-medium text-stone-700">Title</label>
          <input id="project-title"
                 v-model="form.title"
                 type="text"
                 maxlength="200"
                 class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                 @change="saveTitle">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label for="project-location" class="block text-sm font-medium text-stone-700">Location</label>
            <input id="project-location"
                   v-model="form.location"
                   type="text"
                   maxlength="100"
                   list="project-locations"
                   class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                   @change="save({ location: form.location.trim() || null })">
            <datalist id="project-locations">
              <option v-for="known in locations" :key="known" :value="known" />
            </datalist>
          </div>
          <div>
            <label for="project-status" class="block text-sm font-medium text-stone-700">Status</label>
            <select id="project-status"
                    v-model="form.status"
                    class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                    @change="save({ status: form.status })">
              <option v-for="status in PROJECT_STATUSES" :key="status" :value="status">{{ STATUS_LABELS[status] }}</option>
            </select>
          </div>
          <div>
            <label for="project-path" class="block text-sm font-medium text-stone-700">Path</label>
            <select id="project-path"
                    v-model="form.path"
                    class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                    @change="save({ path: form.path === '' ? null : form.path })">
              <option value="">Not decided</option>
              <option v-for="path in PROJECT_PATHS" :key="path" :value="path">{{ PATH_LABELS[path] }}</option>
            </select>
          </div>
        </div>

        <div>
          <label for="project-notes" class="block text-sm font-medium text-stone-700">Notes</label>
          <textarea id="project-notes"
                    v-model="form.notes"
                    rows="4"
                    maxlength="5000"
                    class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                    @change="save({ notes: form.notes.trim() || null })" />
        </div>

        <p class="text-sm h-5" :class="saveError ? 'text-red-700' : 'text-stone-500'" aria-live="polite">
          {{ saveError ?? (saving ? 'Saving...' : savedAt ? 'Saved' : '') }}
        </p>
      </section>

      <!-- Steps -->
      <ProjectSteps :project-id="project.id"
                    :steps="project.steps ?? []"
                    :project-status="project.status"
                    @update:steps="onStepsChange"
                    @all-done="openMarkDone" />

      <!-- Providers -->
      <ProjectProviders :project-id="project.id"
                        :category-id="project.providerCategoryId ?? null"
                        :links="project.providers ?? []"
                        @update:links="onProviderLinksChange"
                        @update:category="onProviderCategoryChange" />

      <!-- Photos -->
      <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
        <h2 class="text-lg font-medium text-stone-900 mb-3">Photos</h2>
        <p v-if="project.photos.length === 0" class="text-sm text-stone-600 mb-3">No photos yet.</p>
        <ul v-else class="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
          <li v-for="photo in project.photos" :key="photo.id" class="relative">
            <button type="button"
                    class="block w-full aspect-square rounded-lg overflow-hidden border border-stone-200"
                    aria-label="View photo full size"
                    @click="viewing = photo.id">
              <AuthedImage :project-id="project.id" :photo-id="photo.id" variant="thumb" :alt="project.title" />
            </button>
            <button type="button"
                    class="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-stone-700 text-sm leading-none hover:bg-white"
                    aria-label="Remove photo"
                    @click="removePhoto(photo.id)">
              &times;
            </button>
          </li>
        </ul>
        <p v-if="photoError" class="text-sm text-red-700 mb-3">{{ photoError }}</p>
        <PhotoUploader :project-id="project.id"
                       :remaining="MAX_PROJECT_PHOTOS - project.photos.length"
                       auto-upload
                       @uploaded="onUploaded" />
      </section>

      <!-- Danger zone -->
      <section class="flex justify-end">
        <button type="button"
                class="text-sm font-medium text-red-700 hover:text-red-800 px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 transition-colors"
                @click="removeProject">
          Delete project
        </button>
      </section>
    </div>

    <MarkDoneDialog v-if="project"
                    :show="markDone.open"
                    :project-title="project.title"
                    after-last-step
                    :saving="markDone.saving"
                    :error="markDone.error"
                    @confirm="confirmMarkDone"
                    @cancel="markDone.open = false" />

    <!-- Full-size viewer -->
    <div v-if="project && viewing"
         class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
         role="dialog"
         aria-modal="true"
         aria-label="Photo"
         @click="closeViewer">
      <PhotoCarousel ref="viewerCarousel"
                     :project-id="project.id"
                     :photo-ids="photoIds"
                     variant="full"
                     contain
                     :start-index="viewingStartIndex"
                     :alt="project.title"
                     @update:current-index="onViewerIndexChange" />

      <button type="button"
              class="absolute top-2 right-2 sm:top-4 sm:right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
              aria-label="Close"
              @click.stop="closeViewer">
        <X :size="24" />
      </button>

      <button v-if="photoIds.length > 1 && viewerIndex > 0"
              type="button"
              class="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white items-center justify-center hover:bg-black/70"
              aria-label="Previous photo"
              @click.stop="viewerCarousel?.prev()">
        <ChevronLeft :size="24" />
      </button>
      <button v-if="photoIds.length > 1 && viewerIndex < photoIds.length - 1"
              type="button"
              class="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white items-center justify-center hover:bg-black/70"
              aria-label="Next photo"
              @click.stop="viewerCarousel?.next()">
        <ChevronRight :size="24" />
      </button>

      <p v-if="photoIds.length > 1"
         class="absolute bottom-2 left-0 right-0 text-center text-sm text-white/90 pointer-events-none">
        {{ viewerIndex + 1 }} / {{ photoIds.length }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { ChevronLeft, ChevronRight, X } from 'lucide-vue-next';
import {
  MAX_PROJECT_PHOTOS,
  PROJECT_PATHS,
  PROJECT_STATUSES,
  type ProjectDetail,
  type ProjectPath,
  type ProjectPhotoDto,
  type ProjectProviderDto,
  type ProjectStatus,
  type ProjectStepDto,
  type ProjectUpdateInput,
} from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import { PATH_LABELS, STATUS_LABELS } from '@/utils/project-labels';
import AuthedImage from '@/components/projects/AuthedImage.vue';
import PhotoUploader from '@/components/projects/PhotoUploader.vue';
import PhotoCarousel from '@/components/projects/PhotoCarousel.vue';
import ProjectSteps from '@/components/projects/ProjectSteps.vue';
import ProjectProviders from '@/components/projects/ProjectProviders.vue';
import MarkDoneDialog from '@/components/projects/MarkDoneDialog.vue';

const route = useRoute();
const id = computed(() => String(route.params.id));

const { getProject, updateProject, deleteProject, deletePhoto, listLocations } = useProjects();

const project = ref<ProjectDetail | null>(null);
const locations = ref<string[]>([]);
const loadError = ref<string | null>(null);
const saveError = ref<string | null>(null);
const photoError = ref<string | null>(null);
const saving = ref(false);
const savedAt = ref<number | null>(null);
// Restarted on every successful save, so the "Saved" text clears ~2s after the latest save settles.
let savedIndicatorTimer: ReturnType<typeof setTimeout> | null = null;
// The id of the photo that was tapped; the viewer opens the carousel on that one. null = closed.
const viewing = ref<string | null>(null);
const viewerCarousel = ref<InstanceType<typeof PhotoCarousel> | null>(null);
const viewerIndex = ref(0);

// Always read from the current photo list, so removing a photo while the viewer is closed, then
// reopening it on another, never refers to a photo that no longer exists.
const photoIds = computed(() => project.value?.photos.map((photo) => photo.id) ?? []);
const viewingStartIndex = computed(() => {
  const index = viewing.value ? photoIds.value.indexOf(viewing.value) : -1;
  return index === -1 ? 0 : index;
});

const form = reactive<{ title: string; location: string; status: ProjectStatus; path: ProjectPath | ''; notes: string }>({
  title: '', location: '', status: 'planning', path: '', notes: '',
});

const fillForm = (detail: ProjectDetail): void => {
  form.title = detail.title;
  form.location = detail.location ?? '';
  form.status = detail.status;
  form.path = detail.path ?? '';
  form.notes = detail.notes ?? '';
};

const save = async (patch: ProjectUpdateInput): Promise<void> => {
  saving.value = true;
  saveError.value = null;
  try {
    const updated = await updateProject(id.value, patch);
    project.value = updated;
    fillForm(updated);
    savedAt.value = Date.now();
    if (savedIndicatorTimer) clearTimeout(savedIndicatorTimer);
    savedIndicatorTimer = setTimeout(() => {
      savedAt.value = null;
      savedIndicatorTimer = null;
    }, 2000);
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Could not save';
    // Put the fields back to what the server has, so the screen never shows an unsaved value as saved.
    if (project.value) fillForm(project.value);
  } finally {
    saving.value = false;
  }
};

const saveTitle = async (): Promise<void> => {
  const title = form.title.trim();
  if (!title) {
    saveError.value = 'Title is required';
    if (project.value) form.title = project.value.title;
    return;
  }
  await save({ title });
};

const onUploaded = (photo: ProjectPhotoDto): void => {
  if (project.value) project.value.photos = [...project.value.photos, photo];
};

// An older server build (mid-deploy) may send a project without `steps`; the template guards the
// read with `?? []`, and every change replaces the array here.
const onStepsChange = (steps: ProjectStepDto[]): void => {
  if (project.value) project.value.steps = steps;
};

// As with steps, an older server build may send a project without `providers` or
// `providerCategoryId`; the template guards both reads, and every change replaces the value here.
const onProviderLinksChange = (links: ProjectProviderDto[]): void => {
  if (project.value) project.value.providers = links;
};

const onProviderCategoryChange = (categoryId: string | null): void => {
  if (project.value) project.value.providerCategoryId = categoryId;
};

const markDone = reactive<{ open: boolean; saving: boolean; error: string | null }>({
  open: false, saving: false, error: null,
});

const openMarkDone = (): void => {
  markDone.error = null;
  markDone.open = true;
};

const confirmMarkDone = async (): Promise<void> => {
  markDone.saving = true;
  markDone.error = null;
  try {
    const updated = await updateProject(id.value, { status: 'done' });
    project.value = updated;
    fillForm(updated);
    markDone.open = false;
  } catch (e) {
    markDone.error = e instanceof Error ? e.message : 'Could not mark the project Done';
  } finally {
    markDone.saving = false;
  }
};

const closeViewer = (): void => {
  viewing.value = null;
};

const onViewerIndexChange = (index: number): void => {
  viewerIndex.value = index;
};

const onViewerKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') closeViewer();
  else if (event.key === 'ArrowLeft') viewerCarousel.value?.prev();
  else if (event.key === 'ArrowRight') viewerCarousel.value?.next();
};

// Keys only matter while the viewer is open, so the listener is added when it opens and removed
// when it closes (and, as a safety net, when the page itself unmounts).
watch(viewing, (value) => {
  if (value) {
    viewerIndex.value = viewingStartIndex.value;
    window.addEventListener('keydown', onViewerKeydown);
  } else {
    window.removeEventListener('keydown', onViewerKeydown);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onViewerKeydown);
  if (savedIndicatorTimer) clearTimeout(savedIndicatorTimer);
});

const removePhoto = async (photoId: string): Promise<void> => {
  if (!project.value) return;
  if (!window.confirm('Remove this photo? This cannot be undone.')) return;
  photoError.value = null;
  try {
    await deletePhoto(id.value, photoId);
    project.value.photos = project.value.photos.filter((photo) => photo.id !== photoId);
  } catch (e) {
    photoError.value = e instanceof Error ? e.message : 'Could not remove the photo';
  }
};

const removeProject = async (): Promise<void> => {
  if (!window.confirm('Delete this project? It will be removed from the list.')) return;
  try {
    await deleteProject(id.value);
    await navigateTo('/projects');
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Could not delete the project';
  }
};

onMounted(async () => {
  try {
    const detail = await getProject(id.value);
    project.value = detail;
    fillForm(detail);
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Could not load this project';
    return;
  }
  try {
    locations.value = await listLocations();
  } catch {
    // Suggestions are a convenience; the page works without them.
    locations.value = [];
  }
});
</script>
