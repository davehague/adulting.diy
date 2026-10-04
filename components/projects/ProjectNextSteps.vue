<template>
  <!-- Rendered only once we know the household has projects, or to report that loading failed. -->
  <div v-if="loadError || data?.hasProjects" class="bg-white rounded-xl shadow-sm border border-stone-100 mb-8">
    <div class="px-6 py-4 border-b border-stone-100">
      <h2 class="font-heading font-semibold text-stone-900">Project next steps</h2>
    </div>

    <div v-if="loadError" class="px-6 py-6 text-sm text-red-700">
      Could not load project steps.
      <button type="button" class="font-medium underline" @click="load">Try again</button>
    </div>

    <div v-else-if="items.length === 0" class="px-6 py-6 text-sm text-stone-500">
      No active projects. Set a project to Active to see its next step here.
      <NuxtLink to="/projects" class="text-amber-700 font-medium">Go to Projects &rarr;</NuxtLink>
    </div>

    <ul v-else class="divide-y divide-stone-50">
      <li v-for="item in items" :key="item.projectId" class="flex items-start gap-3 px-6 py-3.5">
        <input type="checkbox"
               class="mt-0.5 h-5 w-5 shrink-0 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
               :checked="checkingProjectId === item.projectId"
               :disabled="checkingProjectId !== null"
               :aria-label="item.step ? `Done: ${item.step.text}` : `Mark ${item.projectTitle} Done`"
               @change="onCheck(item, $event)">
        <NuxtLink :to="`/projects/${item.projectId}`" class="flex-1 min-w-0">
          <span class="block text-sm font-medium text-stone-900 break-words">
            {{ item.step ? item.step.text : item.projectTitle }}
          </span>
          <span class="block text-xs text-stone-400 break-words">{{ subTextOf(item) }}</span>
        </NuxtLink>
        <span v-if="item.step && item.step.estimateMinutes !== null" class="text-xs text-stone-500 shrink-0 mt-0.5">
          {{ formatMinutes(item.step.estimateMinutes) }}
        </span>
      </li>
    </ul>

    <p v-if="actionError" class="px-6 py-3 border-t border-stone-100 text-sm text-red-700" aria-live="polite">
      {{ actionError }}
    </p>

    <MarkDoneDialog :show="dialog.open"
                    :project-title="dialog.projectTitle"
                    :after-last-step="dialog.afterLastStep"
                    :saving="dialog.saving"
                    :error="dialog.error"
                    @confirm="confirmMarkDone"
                    @cancel="dialog.open = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { type NextStepItem, type NextStepsResponse } from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import { formatMinutes } from '@/utils/project-steps';
import MarkDoneDialog from '@/components/projects/MarkDoneDialog.vue';

const authStore = useAuthStore();
const { listNextSteps, updateStep, updateProject } = useProjects();

const data = ref<NextStepsResponse | null>(null);
const loadError = ref(false);
const actionError = ref<string | null>(null);
// The project whose step is being saved. Its box stays checked until the list reloads; all boxes are disabled meanwhile.
const checkingProjectId = ref<string | null>(null);

// `items` may be missing in a response from an older server build; treat that as empty.
const items = computed<NextStepItem[]>(() => data.value?.items ?? []);

const dialog = reactive<{
  open: boolean; projectId: string; projectTitle: string; afterLastStep: boolean; saving: boolean; error: string | null;
}>({ open: false, projectId: '', projectTitle: '', afterLastStep: false, saving: false, error: null });

const subTextOf = (item: NextStepItem): string => {
  if (item.kind === 'noSteps') return 'No steps yet';
  if (item.kind === 'allDone') return 'All steps done';
  return item.projectTitle;
};

const load = async (): Promise<boolean> => {
  try {
    data.value = await listNextSteps();
    loadError.value = false;
    return true;
  } catch {
    loadError.value = true;
    return false;
  }
};

const openDialog = (item: NextStepItem, afterLastStep: boolean): void => {
  dialog.projectId = item.projectId;
  dialog.projectTitle = item.projectTitle;
  dialog.afterLastStep = afterLastStep;
  dialog.error = null;
  dialog.open = true;
};

const onCheck = async (item: NextStepItem, event: Event): Promise<void> => {
  const box = event.target as HTMLInputElement;
  actionError.value = null;

  // A project shown as itself: nothing is saved unless the dialog is confirmed, so the box goes straight back.
  if (!item.step) {
    box.checked = false;
    openDialog(item, false);
    return;
  }

  checkingProjectId.value = item.projectId;
  try {
    await updateStep(item.projectId, item.step.id, { done: true });
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Could not save the step';
    checkingProjectId.value = null;
    return;
  }

  const reloaded = await load();
  checkingProjectId.value = null;
  if (!reloaded) return;

  const refreshed = items.value.find((candidate) => candidate.projectId === item.projectId);
  if (refreshed?.kind === 'allDone') openDialog(refreshed, true);
};

const confirmMarkDone = async (): Promise<void> => {
  dialog.saving = true;
  dialog.error = null;
  try {
    await updateProject(dialog.projectId, { status: 'done' });
    dialog.open = false;
    await load();
  } catch (e) {
    dialog.error = e instanceof Error ? e.message : 'Could not mark the project Done';
  } finally {
    dialog.saving = false;
  }
};

// Same pattern as the dashboard page: wait for auth before the first request.
onMounted(() => {
  watch(() => authStore.isReady, (ready) => {
    if (ready) load();
  }, { immediate: true });
});
</script>
