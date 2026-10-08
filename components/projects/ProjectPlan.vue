<template>
  <!-- Rendered only for a household that has AI help turned on; everyone else sees the page as it was. A Done project hides it unless there is a real plan to read or an ask is still running. -->
  <section v-if="enabled && (!isDone || running || (plan && !plan.tooVague))" class="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6" aria-label="DIY plan">
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="text-lg font-medium text-stone-900">DIY plan</h2>
      <span v-if="plan && !running" class="text-xs text-stone-500">Planned {{ formatDay(plan.createdAt) }}</span>
    </div>

    <p v-if="error" class="mt-2 text-sm text-red-700" aria-live="polite">{{ error }}</p>

    <div v-if="!isDone" class="mt-3 flex flex-col gap-2 sm:flex-row">
      <input v-model="extraText"
             type="text"
             :maxlength="MAX_EXTRA_TEXT_LENGTH"
             :disabled="running"
             enterkeyhint="go"
             placeholder="Anything to add? (optional)"
             aria-label="Anything to add?"
             class="w-full min-w-0 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm disabled:opacity-60"
             @keydown.enter.prevent="run">
      <button type="button"
              :disabled="running || limitReached"
              class="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
              @click="run">
        {{ buttonLabel }}
      </button>
    </div>

    <p v-if="running" class="mt-2 text-sm text-stone-600" aria-live="polite">Working out the steps...</p>

    <template v-if="plan && !running">
      <p v-if="plan.tooVague" class="mt-3 text-sm text-stone-700">
        Not enough to go on. Add a sentence about what's wrong or what you want done.
      </p>

      <template v-else-if="plan.summary">
        <div class="mt-3">
          <p class="text-sm font-medium text-stone-900">
            {{ PLAN_DIFFICULTY_LABELS[plan.summary.difficulty] }} · about {{ formatMinutes(plan.summary.totalMinutes) }} · {{ dollars(plan.summary.costLow, plan.summary.costHigh) }} <span class="font-normal text-stone-500">(estimates)</span>
          </p>
          <p class="mt-1 text-sm text-stone-700">{{ plan.summary.why }}</p>
          <p v-if="plan.safety" class="mt-1 text-sm text-amber-800">⚠ {{ plan.safety }}</p>
          <div v-if="plan.summary.difficulty === 'hire'" class="mt-2 flex flex-wrap items-center gap-2">
            <span v-if="hasSuggestions" class="text-sm text-stone-600">You have suggested providers for this.</span>
            <button type="button" class="rounded-lg border border-amber-600 px-3 py-1 text-sm font-medium text-amber-700 hover:bg-amber-50" @click="emit('find-provider')">Find a provider</button>
            <button v-if="projectPath !== 'hire'" type="button" class="rounded-lg border border-stone-300 px-3 py-1 text-sm font-medium text-stone-700 hover:bg-stone-50" @click="emit('set-path-hire')">Set path to Hire</button>
          </div>
        </div>

        <div class="mt-4">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-medium text-stone-900">Steps</h3>
            <button v-if="plan.steps.length > 0"
                    type="button"
                    :disabled="adding || pendingSteps.length === 0"
                    class="rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                    @click="addAll">
              Add all
            </button>
          </div>
          <p v-if="addedNote" class="mt-1 text-sm text-stone-600" aria-live="polite">{{ addedNote }}</p>
          <ol v-if="plan.steps.length > 0" class="mt-1 divide-y divide-stone-100">
            <li v-for="(step, index) in plan.steps" :key="index" class="flex items-start gap-2 py-2">
              <div class="min-w-0 flex-1">
                <p class="text-sm text-stone-900 break-words">{{ index + 1 }}. {{ step.text }}</p>
                <p class="mt-0.5 flex flex-wrap gap-x-2 text-xs text-stone-600">
                  <span>{{ formatMinutes(step.minutes) }}</span>
                  <span v-if="step.costHigh > 0">{{ dollars(step.costLow, step.costHigh) }}</span>
                  <span v-if="step.pro" class="font-medium text-amber-800">Pro step</span>
                </p>
                <p v-if="step.pro && step.proWhy" class="mt-0.5 text-xs text-stone-600">{{ step.proWhy }}</p>
              </div>
              <span v-if="isAdded(step.text)" class="shrink-0 pt-1 text-xs font-medium text-stone-500">Added</span>
              <button v-else
                      type="button"
                      :aria-label="`Add step: ${step.text}`"
                      :disabled="adding"
                      class="shrink-0 rounded-lg bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                      @click="addOne(step)">
                Add
              </button>
            </li>
          </ol>
          <p v-else class="mt-1 text-sm text-stone-500">No steps in this plan.</p>
        </div>

        <div class="mt-4">
          <h3 class="text-sm font-medium text-stone-900">Tools</h3>
          <p v-if="plan.tools.length === 0" class="mt-1 text-sm text-stone-500">Nothing to buy for this.</p>
          <template v-else>
            <p v-if="haveTools.length > 0" class="mt-1 text-sm text-stone-700"><span class="text-stone-500">You probably have:</span> {{ haveTools.map((tool) => tool.name).join(', ') }}</p>
            <p v-if="needTools.length > 0" class="mt-1 text-sm text-stone-700"><span class="text-stone-500">You may need:</span> {{ needTools.map((tool) => `${tool.name} (${dollars(tool.priceLow, tool.priceHigh)})`).join(', ') }}</p>
          </template>
        </div>

        <div class="mt-4">
          <h3 class="text-sm font-medium text-stone-900">Materials</h3>
          <p v-if="plan.materials.length === 0" class="mt-1 text-sm text-stone-500">Nothing to buy for this.</p>
          <ul v-else class="mt-1 space-y-0.5">
            <li v-for="(material, index) in plan.materials" :key="index" class="flex justify-between gap-2 text-sm text-stone-700">
              <span class="min-w-0 break-words">{{ material.name }}<span v-if="material.quantity" class="text-stone-500"> ({{ material.quantity }})</span></span>
              <span class="shrink-0">{{ dollars(material.priceLow, material.priceHigh) }}</span>
            </li>
          </ul>
        </div>
      </template>
    </template>
  </section>
</template>

<script lang="ts">
import { type PlanRunResponse } from '@/types/plan';

interface InFlightAsk {
  promise: Promise<PlanRunResponse>;
  extraText: string;
}

// Asks still waiting for the server, by project id, so leaving the page during the wait and coming back picks the same ask up. Per browser tab; lost on a page reload.
const inFlight = new Map<string, InFlightAsk>();
</script>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { format } from 'date-fns';
import { PLAN_DIFFICULTY_LABELS, type PlanStep, type ProjectPlanDto } from '@/types/plan';
import { MAX_EXTRA_TEXT_LENGTH } from '@/types/suggestion';
import { type ProjectPath, type ProjectStatus, type ProjectStepDto } from '@/types/project';
import { useProjects } from '@/composables/useProjects';
import { hasApiStatus } from '@/utils/api-error';
import { formatMinutes, hasStepText } from '@/utils/project-steps';

const props = defineProps<{
  projectId: string;
  // the checklist as it is now; "Added" markers follow it
  steps: ProjectStepDto[];
  projectStatus: ProjectStatus;
  projectPath: ProjectPath | null;
}>();

const emit = defineEmits<{
  (e: 'update:steps', steps: ProjectStepDto[]): void;
  (e: 'find-provider'): void;
  (e: 'set-path-hire'): void;
  (e: 'enabled', value: boolean): void;
}>();

const { getPlan, runPlan, addStep, addSteps } = useProjects();

const enabled = ref(false);
const limitReached = ref(false);
const hasSuggestions = ref(false);
const plan = ref<ProjectPlanDto | null>(null);
const extraText = ref('');
const running = ref(false);
const failed = ref(false);
const error = ref<string | null>(null);
const adding = ref(false);
const addedNote = ref<string | null>(null);

const isDone = computed(() => props.projectStatus === 'done');

const buttonLabel = computed((): string => {
  if (limitReached.value) return 'Daily limit reached. Try again later.';
  if (failed.value) return 'Try again';
  return plan.value ? 'Plan again' : 'Plan it';
});

const isAdded = (text: string): boolean => hasStepText(props.steps, text);
const pendingSteps = computed((): PlanStep[] => (plan.value?.steps ?? []).filter((step) => !isAdded(step.text)));
const haveTools = computed(() => plan.value?.tools.filter((tool) => tool.have) ?? []);
const needTools = computed(() => plan.value?.tools.filter((tool) => !tool.have) ?? []);

const dollars = (low: number, high: number): string => (low === high ? `$${low}` : `$${low} to $${high}`);

const formatDay = (value: string | Date): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : format(parsed, 'MMM d');
};

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error ? e.message : fallback);

// Shows the outcome of an ask. It never rejects, so every caller can await it.
const follow = async (promise: Promise<PlanRunResponse>): Promise<void> => {
  try {
    const response = await promise;
    limitReached.value = response.limitReached === true;
    hasSuggestions.value = response.hasSuggestions === true;
    // On a failure this is the previous plan, so what was on screen stays there under the error.
    plan.value = response.plan ?? null;
    if (response.status === 'failed') {
      failed.value = true;
      error.value = 'Could not make a plan.';
    }
  } catch (e) {
    if (hasApiStatus(e, 429)) {
      limitReached.value = true;
    } else if (hasApiStatus(e, 403)) {
      enabled.value = false;
    } else {
      failed.value = true;
      error.value = 'Could not make a plan.';
    }
  } finally {
    running.value = false;
  }
};

const run = async (): Promise<void> => {
  if (running.value || limitReached.value || isDone.value) return;
  running.value = true;
  failed.value = false;
  error.value = null;
  addedNote.value = null;

  const projectId = props.projectId;
  const text = extraText.value.trim();
  // Wrapped so that even a synchronous throw becomes a rejection that follow() handles.
  const promise = (async () => runPlan(projectId, text))();
  const entry: InFlightAsk = { promise, extraText: text };
  inFlight.set(projectId, entry);
  const release = (): void => {
    if (inFlight.get(projectId) === entry) inFlight.delete(projectId);
  };
  promise.then(release, release);

  await follow(promise);
};

const addOne = async (step: PlanStep): Promise<void> => {
  if (adding.value) return;
  adding.value = true;
  error.value = null;
  addedNote.value = null;
  try {
    const created = await addStep(props.projectId, { text: step.text, estimateMinutes: step.minutes > 0 ? step.minutes : null });
    emit('update:steps', [...props.steps, created]);
  } catch (e) {
    error.value = messageOf(e, 'Could not add the step');
  } finally {
    adding.value = false;
  }
};

const addAll = async (): Promise<void> => {
  if (adding.value || pendingSteps.value.length === 0) return;
  adding.value = true;
  error.value = null;
  addedNote.value = null;
  const wanted = pendingSteps.value.length;
  try {
    const response = await addSteps(
      props.projectId,
      pendingSteps.value.map((step) => ({ text: step.text, estimateMinutes: step.minutes > 0 ? step.minutes : null })),
    );
    emit('update:steps', response.steps ?? props.steps);
    const added = wanted - (response.skipped ?? 0);
    addedNote.value = response.skipped > 0 ? `Added ${added} of ${wanted} steps; the checklist is full.` : `Added ${added} steps.`;
  } catch (e) {
    error.value = messageOf(e, 'Could not add the steps');
  } finally {
    adding.value = false;
  }
};

onMounted(async () => {
  const pending = inFlight.get(props.projectId);
  if (pending) {
    // The page was left during an ask and opened again before the answer came: pick that ask up.
    enabled.value = true;
    emit('enabled', true);
    extraText.value = pending.extraText;
    running.value = true;
    await follow(pending.promise);
    return;
  }
  try {
    const state = await getPlan(props.projectId);
    enabled.value = state.enabled === true;
    emit('enabled', enabled.value);
    limitReached.value = state.limitReached === true;
    hasSuggestions.value = state.hasSuggestions === true;
    plan.value = state.plan ?? null;
    extraText.value = state.plan?.extraText ?? '';
  } catch {
    // The page works without a plan; say nothing.
  }
});
</script>
