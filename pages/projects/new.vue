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
               :disabled="!!createdId"
               placeholder="Paint ceiling blemish spots"
               class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm disabled:bg-stone-50 disabled:text-stone-500">
      </div>

      <div>
        <label for="project-location" class="block text-sm font-medium text-stone-700">Location <span class="font-normal text-stone-500">(optional)</span></label>
        <input id="project-location"
               v-model="location"
               type="text"
               maxlength="100"
               list="project-locations"
               :disabled="!!createdId"
               placeholder="Hallway"
               class="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm disabled:bg-stone-50 disabled:text-stone-500">
        <datalist id="project-locations">
          <option v-for="known in locations" :key="known" :value="known" />
        </datalist>
      </div>

      <div>
        <p class="block text-sm font-medium text-stone-700 mb-2">Photos <span class="font-normal text-stone-500">(optional)</span></p>
        <PhotoUploader ref="uploader" :remaining="MAX_PROJECT_PHOTOS" />
      </div>

      <p v-if="error" class="text-sm text-red-700">{{ error }}</p>

      <div v-if="createdId && !saving" class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-stone-700">
        The project is saved, but some photos did not upload. Retry them above, or
        <NuxtLink :to="`/projects/${createdId}`" class="font-medium text-amber-700 hover:text-amber-800">go to the project</NuxtLink>
        and add them later.
      </div>

      <div class="flex items-center gap-3">
        <button type="submit"
                :disabled="saving"
                class="inline-flex items-center bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-60">
          {{ saving ? 'Saving...' : createdId ? 'Retry photos' : 'Save' }}
        </button>
        <NuxtLink v-if="!createdId" to="/projects" class="text-sm text-stone-600 hover:text-stone-900">Cancel</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { MAX_PROJECT_PHOTOS } from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import PhotoUploader from '@/components/projects/PhotoUploader.vue';

const { createProject, listLocations } = useProjects();

const title = ref('');
const location = ref('');
const locations = ref<string[]>([]);
const saving = ref(false);
const error = ref<string | null>(null);
// Set once the project exists, so a second Save only retries photos and never creates a duplicate.
const createdId = ref<string | null>(null);
const uploader = ref<InstanceType<typeof PhotoUploader> | null>(null);

const save = async (): Promise<void> => {
  if (saving.value) return;
  error.value = null;
  if (!createdId.value && !title.value.trim()) {
    error.value = 'Title is required';
    return;
  }
  saving.value = true;
  try {
    if (!createdId.value) {
      const created = await createProject({ title: title.value.trim(), location: location.value.trim() || null });
      createdId.value = created.id;
    }
    const allUploaded = uploader.value ? await uploader.value.uploadAll(createdId.value) : true;
    if (allUploaded) await navigateTo(`/projects/${createdId.value}`);
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
