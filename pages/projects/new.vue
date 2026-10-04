<template>
  <div class="container mx-auto px-4 py-8 max-w-2xl">
    <NuxtLink to="/projects" class="text-sm text-amber-700 hover:text-amber-800">&larr; All projects</NuxtLink>
    <h1 class="text-2xl font-bold text-stone-900 font-heading mt-2 mb-6">New project</h1>

    <form class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6 space-y-5" @submit.prevent="save">
      <div>
        <label for="project-title" class="block text-sm font-medium text-stone-700">Title</label>
        <input id="project-title"
               v-model="title"
               type="text"
               maxlength="200"
               placeholder="Paint ceiling blemish spots"
               class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm">
      </div>

      <div>
        <label for="project-location" class="block text-sm font-medium text-stone-700">Location <span class="font-normal text-stone-500">(optional)</span></label>
        <input id="project-location"
               v-model="location"
               type="text"
               maxlength="100"
               list="project-locations"
               placeholder="Hallway"
               class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm">
        <datalist id="project-locations">
          <option v-for="known in locations" :key="known" :value="known" />
        </datalist>
      </div>

      <div>
        <label for="project-notes" class="block text-sm font-medium text-stone-700">Notes <span class="font-normal text-stone-500">(optional)</span></label>
        <textarea id="project-notes"
                  v-model="notes"
                  rows="4"
                  maxlength="5000"
                  placeholder="What's wrong, what you want, anything worth remembering"
                  class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm" />
      </div>

      <div>
        <p class="block text-sm font-medium text-stone-700 mb-2">Photos <span class="font-normal text-stone-500">(optional)</span></p>
        <PhotoUploader ref="uploader"
                       :remaining="remainingPhotoSlots"
                       auto-upload
                       keep-uploaded
                       :ensure-project-id="ensureProject"
                       @uploaded="onPhotoUploaded" />
      </div>

      <p v-if="error" class="text-sm text-red-700">{{ error }}</p>

      <div v-if="showUploadIssue" class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-stone-700">
        The project is saved, but some photos did not upload. Retry them above, or
        <NuxtLink :to="`/projects/${createdId}`" class="font-medium text-amber-700 hover:text-amber-800">go to the project</NuxtLink>
        and add them later.
      </div>

      <div class="flex items-center gap-3">
        <button type="submit"
                :disabled="saving"
                class="inline-flex items-center bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-60">
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
        <NuxtLink to="/projects" class="text-sm text-stone-600 hover:text-stone-900">Cancel</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { MAX_PROJECT_PHOTOS, UNTITLED_PROJECT_TITLE, type ProjectPhotoDto } from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import PhotoUploader from '@/components/projects/PhotoUploader.vue';

const { createProject, updateProject, listLocations } = useProjects();

const title = ref('');
const location = ref('');
const notes = ref('');
const locations = ref<string[]>([]);
const saving = ref(false);
const error = ref<string | null>(null);
// Set by save() when uploads finished with at least one failure, so the amber notice below shows.
const showUploadIssue = ref(false);
// Set once the project exists, whether that happened via a photo pick or via Save.
const createdId = ref<string | null>(null);
// Counts photos this uploader has finished, so the cap counts uploaded photos too even though they
// stay visible here (this page has no separate server-rendered photo grid to count them instead).
const uploadedCount = ref(0);
const uploader = ref<InstanceType<typeof PhotoUploader> | null>(null);

const remainingPhotoSlots = computed(() => MAX_PROJECT_PHOTOS - uploadedCount.value);

const onPhotoUploaded = (_photo: ProjectPhotoDto): void => {
  uploadedCount.value += 1;
};

// Ensures the project exists, creating it at most once. Passed to PhotoUploader so a photo pick can
// create the project itself; also used by save(). Concurrent callers (two picks, or a pick racing a
// Save tap) share the same in-flight create via `creating`. A failed create clears `creating` so the
// next call (another pick, a per-photo Retry, or Save) starts a fresh attempt.
let creating: Promise<string> | null = null;
const ensureProject = (): Promise<string> => {
  if (createdId.value) return Promise.resolve(createdId.value);
  if (creating) return creating;
  creating = (async (): Promise<string> => {
    try {
      const created = await createProject({
        title: title.value.trim() || UNTITLED_PROJECT_TITLE,
        location: location.value.trim() || null,
        notes: notes.value.trim() || null,
      });
      createdId.value = created.id;
      return created.id;
    } finally {
      creating = null;
    }
  })();
  return creating;
};

const save = async (): Promise<void> => {
  if (saving.value) return;
  error.value = null;
  const trimmedTitle = title.value.trim();
  if (!trimmedTitle) {
    error.value = 'Title is required';
    return;
  }
  saving.value = true;
  showUploadIssue.value = false;
  try {
    const id = await ensureProject();
    // Always send the current fields, even if the project already existed: it may have been created
    // by a photo pick (possibly with "Untitled project") before the user finished typing, and a pick
    // racing this Save can only have used the fields as they were at pick time.
    await updateProject(id, {
      title: trimmedTitle,
      location: location.value.trim() || null,
      notes: notes.value.trim() || null,
    });
    const allUploaded = uploader.value ? await uploader.value.uploadAll(id) : true;
    if (allUploaded) {
      await navigateTo(`/projects/${id}`);
    } else {
      showUploadIssue.value = true;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not save the project';
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  try {
    locations.value = await listLocations();
  } catch {
    // Suggestions are a convenience; the form works without them.
    locations.value = [];
  }
});
</script>
