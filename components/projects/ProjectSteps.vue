<template>
  <section class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6">
    <h2 class="text-lg font-medium text-stone-900 mb-3">Steps</h2>

    <p v-if="steps.length === 0" class="text-sm text-stone-600 mb-3">No steps yet.</p>
    <ul v-else class="divide-y divide-stone-100 mb-3">
      <li v-for="step in steps" :key="step.id" class="py-2">
        <div class="flex items-start gap-3">
          <input type="checkbox"
                 class="mt-0.5 h-5 w-5 shrink-0 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                 :checked="!!step.doneAt"
                 :disabled="busyIds.includes(step.id)"
                 :aria-label="`Done: ${step.text}`"
                 @change="toggleDone(step, $event)">

          <!-- Closed row: wrapping text, tap to edit. -->
          <button v-if="editingId !== step.id"
                  type="button"
                  class="flex-1 min-w-0 text-left"
                  @click="openEditor(step)">
            <span class="block text-sm break-words"
                  :class="step.doneAt ? 'line-through text-stone-400' : 'text-stone-900'">{{ step.text }}</span>
            <span v-if="step.estimateMinutes !== null" class="block text-xs text-stone-500 mt-0.5">
              {{ formatMinutes(step.estimateMinutes) }}
            </span>
          </button>

          <!-- Open row: each field saves when it loses focus or Enter is pressed. -->
          <div v-else class="flex-1 min-w-0 space-y-2">
            <input :id="`step-text-${step.id}`"
                   type="text"
                   :maxlength="MAX_STEP_TEXT_LENGTH"
                   :value="step.text"
                   aria-label="Step"
                   class="w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                   @change="saveText(step, $event)"
                   @keydown.enter.prevent="blurTarget">
            <div class="flex flex-wrap items-center gap-2">
              <label :for="`step-estimate-${step.id}`" class="text-xs text-stone-600">Estimate (minutes)</label>
              <input :id="`step-estimate-${step.id}`"
                     type="number"
                     inputmode="numeric"
                     min="1"
                     :max="MAX_STEP_ESTIMATE_MINUTES"
                     step="1"
                     :value="step.estimateMinutes ?? ''"
                     class="w-24 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                     @change="saveEstimate(step, $event)"
                     @keydown.enter.prevent="blurTarget">
              <span class="flex-1" />
              <button type="button"
                      class="text-sm font-medium text-red-700 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50"
                      :disabled="busyIds.includes(step.id)"
                      @click="removeStep(step)">
                Remove
              </button>
              <button type="button"
                      class="text-sm font-medium text-stone-600 px-2 py-1 rounded-lg hover:bg-stone-100"
                      @click="editingId = null">
                Close
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <p v-if="error" class="text-sm text-red-700 mb-3" aria-live="polite">{{ error }}</p>

    <form v-if="steps.length < MAX_PROJECT_STEPS" class="flex gap-2" @submit.prevent="addNewStep">
      <input ref="newStepInput"
             v-model="newText"
             type="text"
             :maxlength="MAX_STEP_TEXT_LENGTH"
             placeholder="Add a step"
             aria-label="Add a step"
             class="flex-1 min-w-0 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm">
      <button type="submit"
              :disabled="adding || newText.trim() === ''"
              class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
        <Plus :size="16" />Add
      </button>
    </form>
    <p v-else class="text-sm text-stone-600">That's the maximum of {{ MAX_PROJECT_STEPS }} steps for a project.</p>
  </section>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { Plus } from 'lucide-vue-next';
import {
  MAX_PROJECT_STEPS,
  MAX_STEP_ESTIMATE_MINUTES,
  MAX_STEP_TEXT_LENGTH,
  type ProjectStatus,
  type ProjectStepDto,
} from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import { formatMinutes, nextStepOf } from '@/utils/project-steps';

const props = defineProps<{
  projectId: string;
  steps: ProjectStepDto[];
  projectStatus: ProjectStatus;
}>();

const emit = defineEmits<{
  (e: 'update:steps', steps: ProjectStepDto[]): void;
  // a step was just checked and every step is now done, on a project that is not Done yet
  (e: 'all-done'): void;
}>();

const { addStep, updateStep, deleteStep } = useProjects();

const error = ref<string | null>(null);
const busyIds = ref<string[]>([]);
const editingId = ref<string | null>(null);
const newText = ref('');
const adding = ref(false);
const newStepInput = ref<HTMLInputElement | null>(null);

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error ? e.message : fallback);

const withStep = (updated: ProjectStepDto): ProjectStepDto[] =>
  props.steps.map((step) => (step.id === updated.id ? updated : step));

const setBusy = (stepId: string, busy: boolean): void => {
  busyIds.value = busy ? [...busyIds.value, stepId] : busyIds.value.filter((id) => id !== stepId);
};

const blurTarget = (event: Event): void => {
  (event.target as HTMLElement).blur();
};

const openEditor = async (step: ProjectStepDto): Promise<void> => {
  editingId.value = step.id;
  await nextTick();
  document.getElementById(`step-text-${step.id}`)?.focus();
};

const toggleDone = async (step: ProjectStepDto, event: Event): Promise<void> => {
  const box = event.target as HTMLInputElement;
  const done = box.checked;
  error.value = null;
  setBusy(step.id, true);
  try {
    const updated = await updateStep(props.projectId, step.id, { done });
    const next = withStep(updated);
    emit('update:steps', next);
    if (done && props.projectStatus !== 'done' && nextStepOf(next).kind === 'allDone') emit('all-done');
  } catch (e) {
    // The bound value did not change, so Vue will not reset the box; put it back by hand.
    box.checked = !done;
    error.value = messageOf(e, 'Could not save the step');
  } finally {
    setBusy(step.id, false);
  }
};

const saveText = async (step: ProjectStepDto, event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const text = input.value.trim();
  error.value = null;
  if (text === '') {
    error.value = 'Step text is required';
    input.value = step.text;
    return;
  }
  if (text === step.text) {
    input.value = step.text;
    return;
  }
  try {
    emit('update:steps', withStep(await updateStep(props.projectId, step.id, { text })));
  } catch (e) {
    input.value = step.text;
    error.value = messageOf(e, 'Could not save the step');
  }
};

const saveEstimate = async (step: ProjectStepDto, event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const saved = step.estimateMinutes === null ? '' : String(step.estimateMinutes);
  const raw = input.value.trim();
  const estimateMessage = `Estimate must be a whole number of minutes from 1 to ${MAX_STEP_ESTIMATE_MINUTES}`;
  error.value = null;

  // A number field holding invalid text reports an empty value; without this check that would clear a saved estimate.
  if (input.validity.badInput) {
    error.value = estimateMessage;
    input.value = saved;
    return;
  }

  let estimateMinutes: number | null = null;
  if (raw !== '') {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_STEP_ESTIMATE_MINUTES) {
      error.value = estimateMessage;
      input.value = saved;
      return;
    }
    estimateMinutes = parsed;
  }
  if (estimateMinutes === step.estimateMinutes) return;

  try {
    emit('update:steps', withStep(await updateStep(props.projectId, step.id, { estimateMinutes })));
  } catch (e) {
    input.value = saved;
    error.value = messageOf(e, 'Could not save the estimate');
  }
};

const removeStep = async (step: ProjectStepDto): Promise<void> => {
  if (!window.confirm('Remove this step? This cannot be undone.')) return;
  error.value = null;
  setBusy(step.id, true);
  try {
    await deleteStep(props.projectId, step.id);
    if (editingId.value === step.id) editingId.value = null;
    emit('update:steps', props.steps.filter((existing) => existing.id !== step.id));
  } catch (e) {
    error.value = messageOf(e, 'Could not remove the step');
  } finally {
    setBusy(step.id, false);
  }
};

const addNewStep = async (): Promise<void> => {
  const text = newText.value.trim();
  if (text === '' || adding.value) return;
  error.value = null;
  adding.value = true;
  try {
    const created = await addStep(props.projectId, { text });
    emit('update:steps', [...props.steps, created]);
    newText.value = '';
  } catch (e) {
    error.value = messageOf(e, 'Could not add the step');
  } finally {
    adding.value = false;
  }
  // Keep the cursor in the box so several steps can be typed in a row.
  await nextTick();
  newStepInput.value?.focus();
};
</script>
