<template>
  <form @submit.prevent="handleSubmit" class="space-y-6">
    <!-- Name Field -->
    <div>
      <label for="name" class="block text-sm font-medium text-stone-700">Name*</label>
      <input id="name" v-model="formData.name" type="text" required
        class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
        placeholder="Task name" />
    </div>

    <!-- Category Field -->
    <div>
      <label for="categoryId" class="block text-sm font-medium text-stone-700">Category*</label>
      <select id="categoryId" v-model="formData.categoryId" required
        class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500">
        <option disabled value="">Select a category</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">
          {{ category.name }}
        </option>
      </select>
    </div>

    <!-- Description Field -->
    <div>
      <label for="description" class="block text-sm font-medium text-stone-700">Description</label>
      <textarea id="description" v-model="formData.description" rows="3"
        class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
        placeholder="Optional task description"></textarea>
    </div>

    <!-- Instructions Field -->
    <div>
      <label for="instructions" class="block text-sm font-medium text-stone-700">Instructions</label>
      <textarea id="instructions" v-model="formData.instructions" rows="4"
        class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
        placeholder="Step-by-step instructions for completing this task"></textarea>
    </div>

    <!-- Schedule Configuration -->
    <div class="border rounded-lg p-4 bg-stone-50">
      <h3 class="text-lg font-medium text-stone-700 mb-4 font-heading">Schedule Configuration</h3>

      <!-- Schedule Type -->
      <div class="mb-4">
        <label for="scheduleType" class="block text-sm font-medium text-stone-700">Schedule Type*</label>
        <select id="scheduleType" v-model="formData.scheduleConfig.type" required
          class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500">
          <option value="once">One Time</option>
          <option value="fixed_interval">Fixed Interval</option>
          <option value="specific_days_of_week">Specific Days of Week</option>
          <option value="specific_day_of_month">Specific Day of Month</option>
          <option value="specific_weekday_of_month">Specific Weekday of Month</option>
          <option value="variable_interval">Variable Interval (After Completion)</option>
          <option value="annual_fixed">Annual (Fixed Date)</option>
          <option value="annual_variable">Annual (After Completion)</option>
        </select>
      </div>

      <!-- Fixed Interval Options -->
      <div v-if="formData.scheduleConfig.type === 'fixed_interval'" class="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="interval" class="block text-sm font-medium text-stone-700">Interval*</label>
          <input id="interval" v-model.number="formData.scheduleConfig.interval" type="number" min="1" required
            class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500" />
        </div>
        <div>
          <label for="intervalUnit" class="block text-sm font-medium text-stone-700">Unit*</label>
          <select id="intervalUnit" v-model="formData.scheduleConfig.intervalUnit" required
            class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500">
            <option value="day">Day(s)</option>
            <option value="week">Week(s)</option>
            <option value="month">Month(s)</option>
            <option value="year">Year(s)</option>
          </select>
        </div>
      </div>

      <!-- Specific Days of Week Options -->
      <div v-if="formData.scheduleConfig.type === 'specific_days_of_week'" class="mb-4">
        <label class="block text-sm font-medium text-stone-700 mb-2">Days of Week*</label>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div v-for="day in daysOfWeek" :key="day.value">
            <label class="inline-flex items-center">
              <input type="checkbox" v-if="formData.scheduleConfig.type === 'specific_days_of_week'"
                v-model="(formData.scheduleConfig as SpecificDaysScheduleConfig).daysOfWeek[day.value as keyof DaysOfWeek]"
                class="rounded border-stone-300 text-amber-700 shadow-sm focus:border-amber-300 focus:ring focus:ring-amber-200 focus:ring-opacity-50" />
              <span class="ml-2">{{ day.label }}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Specific Day of Month Options -->
      <div v-if="formData.scheduleConfig.type === 'specific_day_of_month'" class="mb-4">
        <label for="dayOfMonth" class="block text-sm font-medium text-stone-700">Day of Month*</label>
        <input id="dayOfMonth" v-model.number="formData.scheduleConfig.dayOfMonth" type="number" min="1" max="31"
          required
          class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500" />
      </div>

      <!-- Specific Weekday of Month Options -->
      <div v-if="formData.scheduleConfig.type === 'specific_weekday_of_month'"
        class="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="weekdayOccurrence" class="block text-sm font-medium text-stone-700">Occurrence*</label>
          <select id="weekdayOccurrence" v-model="formData.scheduleConfig.weekdayOfMonth.occurrence" required
            class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500">
            <option value="first">First</option>
            <option value="second">Second</option>
            <option value="third">Third</option>
            <option value="fourth">Fourth</option>
            <option value="last">Last</option>
          </select>
        </div>
        <div>
          <label for="weekday" class="block text-sm font-medium text-stone-700">Weekday*</label>
          <select id="weekday" v-model="formData.scheduleConfig.weekdayOfMonth.weekday" required
            class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500">
            <option v-for="day in daysOfWeek" :key="day.value" :value="day.value">
              {{ day.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- Variable Interval Options -->
      <div v-if="formData.scheduleConfig.type === 'variable_interval'" class="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="variableInterval" class="block text-sm font-medium text-stone-700">Interval*</label>
          <input id="variableInterval" v-model.number="formData.scheduleConfig.variableInterval.interval" type="number"
            min="1" required
            class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500" />
        </div>
        <div>
          <label for="variableUnit" class="block text-sm font-medium text-stone-700">Unit*</label>
          <select id="variableUnit" v-model="formData.scheduleConfig.variableInterval.unit" required
            class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500">
            <option value="day">Day(s)</option>
            <option value="week">Week(s)</option>
            <option value="month">Month(s)</option>
            <option value="year">Year(s)</option>
          </select>
        </div>
      </div>

      <!-- Annual Fixed / Annual Variable Options -->
      <div v-if="formData.scheduleConfig.type === 'annual_fixed' || formData.scheduleConfig.type === 'annual_variable'" class="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="annualMonth" class="block text-sm font-medium text-stone-700">Month*</label>
          <select id="annualMonth" v-model.number="formData.scheduleConfig.month" required
            class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500">
            <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
        <div>
          <label for="annualDay" class="block text-sm font-medium text-stone-700">Day of Month*</label>
          <input id="annualDay" v-model.number="formData.scheduleConfig.dayOfMonth" type="number" min="1"
            max="31" required
            class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500" />
        </div>
      </div>

      <!-- End Condition -->
      <div class="mb-4">
        <label for="endConditionType" class="block text-sm font-medium text-stone-700">End Condition*</label>
        <select id="endConditionType" v-model="formData.scheduleConfig.endCondition.type" required
          class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500">
          <option value="never">Never (Run indefinitely)</option>
          <option value="times">After specified number of times</option>
          <option value="date">Until specified date</option>
        </select>
      </div>

      <!-- End Condition Options -->
      <div v-if="formData.scheduleConfig.endCondition.type === 'times'" class="mb-4">
        <label for="endTimes" class="block text-sm font-medium text-stone-700">Number of Times*</label>
        <input id="endTimes" v-model.number="formData.scheduleConfig.endCondition.times" type="number" min="1" required
          class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500" />
      </div>

      <div v-if="formData.scheduleConfig.endCondition.type === 'date'" class="mb-4">
        <label for="endDate" class="block text-sm font-medium text-stone-700">End Date*</label>
        <input id="endDate" v-model="endDateString" type="date" required
          class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500" />
      </div>
    </div>

    <!-- Reminder Configuration -->
    <div class="border rounded-lg p-4 bg-stone-50">
      <h3 class="text-lg font-medium text-stone-700 mb-4 font-heading">Reminders</h3>

      <div v-for="(reminder, index) in formData.reminders" :key="index" class="mb-3 flex items-center gap-2">
        <select v-model="reminder.timing"
          class="rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
          @change="onTimingChange(index)">
          <option value="on">on due date</option>
          <option value="before">before due date</option>
          <option value="after">after due date</option>
        </select>
        <template v-if="reminder.timing !== 'on'">
          <span class="text-sm text-stone-600">by</span>
          <input v-model.number="reminder.days" type="number" min="0"
            class="w-20 rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
            placeholder="0" />
          <span class="text-sm text-stone-600">days</span>
        </template>
        <button type="button" @click="removeReminder(index)"
          class="text-stone-400 hover:text-red-500 transition-colors p-1">
          <X :size="16" />
        </button>
      </div>

      <button v-if="formData.reminders.length < 5" type="button" @click="addReminder"
        class="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-800 font-medium mt-1">
        <Plus :size="16" /> Add Reminder
      </button>
      <p v-if="formData.reminders.length === 0" class="text-sm text-stone-400">No reminders configured.</p>
    </div>

    <!-- Default Assignees -->
    <div>
      <!-- Add Default Assignee functionality here if user list is available -->
      <!-- This would require fetching household users and allowing selections -->
    </div>

    <!-- Form Buttons -->
    <div class="flex justify-end space-x-3">
      <NuxtLink :to="cancelUrl"
        class="inline-flex items-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors">
        <X :size="16" />Cancel
      </NuxtLink>
      <button type="submit"
        class="inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
        :disabled="isSubmitting">
        <Check :size="16" />{{ isSubmitting ? 'Saving...' : submitButtonText }}
      </button>
    </div>

    <!-- Validation Errors -->
    <div v-if="validationError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
      <p>{{ validationError }}</p>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watchEffect, computed } from 'vue';
import { useApi } from '@/utils/api';
import { Check, X, Plus } from 'lucide-vue-next';
import type {
  Category,
  TaskDefinition,
  ScheduleConfig,
  ReminderConfig,
  ReminderEntry,
  ReminderTiming,
  FixedIntervalScheduleConfig,
  SpecificDaysScheduleConfig,
  SpecificDayOfMonthScheduleConfig,
  SpecificWeekdayOfMonthScheduleConfig,
  VariableIntervalScheduleConfig,
  AnnualFixedScheduleConfig,
  AnnualVariableScheduleConfig,
  EndConditionType,
  OnceScheduleConfig,
  DaysOfWeek,
} from '@/types';

// Props
interface Props {
  task?: TaskDefinition; // For editing, undefined for creating
  submitButtonText?: string;
  cancelUrl?: string;
}

const props = withDefaults(defineProps<Props>(), {
  submitButtonText: 'Save Task',
  cancelUrl: '/tasks'
});

// Emits
const emit = defineEmits<{
  (e: 'submit', data: any): void;
  (e: 'cancel'): void;
}>();

// Setup
const api = useApi();
const categories = ref<Category[]>([]);
const isSubmitting = ref(false);
const validationError = ref('');

// Form data structure
const formData = reactive({
  name: '',
  categoryId: '',
  description: '',
  instructions: '',
  scheduleConfig: {
    // Initialize with minimal properties for the default 'once' type
    type: 'once',
    dueDate: new Date(),
    endCondition: {
      type: 'never',
      times: undefined,
      date: undefined // Initialize date string as undefined
    }
    // Other properties (interval, daysOfWeek, etc.) will be added dynamically
    // when the type changes, but we need a valid initial state.
  } as ScheduleConfig, // Assert as the union type
  reminders: [] as ReminderEntry[],
  defaultAssigneeIds: [] as string[]
});

// Days of week options for form
const daysOfWeek = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' }
];

// Months options for form
const months = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

// Computed property for date input binding
const endDateString = computed({
  get: () => {
    const date = formData.scheduleConfig.endCondition.date;
    return date instanceof Date ? date.toISOString().split('T')[0] : '';
  },
  set: (value) => {
    formData.scheduleConfig.endCondition.date = value ? new Date(value) : undefined;
  }
});

// Load data and initialize form
onMounted(async () => {
  try {
    // Fetch categories
    const categoriesData = await api.get<Category[]>('/api/categories');
    categories.value = categoriesData;

    // If editing, populate form with task data
    if (props.task) {
      populateFormFromTask();
    }
  } catch (err) {
    console.error('Error initializing form:', err);
    validationError.value = 'Failed to load form data. Please try refreshing the page.';
  }
});

// Populate form from task data (for editing)
const populateFormFromTask = () => {
  if (!props.task) return;

  formData.name = props.task.name;
  formData.categoryId = props.task.categoryId;
  formData.description = props.task.description || '';
  formData.instructions = props.task.instructions || '';

  // Handle scheduleConfig (with careful type conversion)
  if (props.task.scheduleConfig) {
    const sc = props.task.scheduleConfig;
    formData.scheduleConfig.type = sc.type;

    if (sc.type === 'fixed_interval') {
      (formData.scheduleConfig as FixedIntervalScheduleConfig).interval = sc.interval || 1;
      (formData.scheduleConfig as FixedIntervalScheduleConfig).intervalUnit = sc.intervalUnit || 'week';
    }
    else if (sc.type === 'specific_days_of_week' && sc.daysOfWeek) {
      (formData.scheduleConfig as SpecificDaysScheduleConfig).daysOfWeek = { ...sc.daysOfWeek };
    }
    else if (sc.type === 'specific_day_of_month') {
      (formData.scheduleConfig as SpecificDayOfMonthScheduleConfig).dayOfMonth = sc.dayOfMonth || 1;
    }
    else if (sc.type === 'specific_weekday_of_month' && sc.weekdayOfMonth) {
      (formData.scheduleConfig as SpecificWeekdayOfMonthScheduleConfig).weekdayOfMonth = { ...sc.weekdayOfMonth };
    }
    else if (sc.type === 'variable_interval' && sc.variableInterval) {
      (formData.scheduleConfig as VariableIntervalScheduleConfig).variableInterval = { ...sc.variableInterval };
    }
    else if (sc.type === 'annual_fixed') {
      (formData.scheduleConfig as AnnualFixedScheduleConfig).month = sc.month || 1;
      (formData.scheduleConfig as AnnualFixedScheduleConfig).dayOfMonth = sc.dayOfMonth || 1;
    }
    else if (sc.type === 'annual_variable') {
      (formData.scheduleConfig as AnnualVariableScheduleConfig).month = sc.month || 1;
      (formData.scheduleConfig as AnnualVariableScheduleConfig).dayOfMonth = sc.dayOfMonth || 1;
    }

    // End condition
    if (sc.endCondition) {
      formData.scheduleConfig.endCondition.type = sc.endCondition.type;

      if (sc.endCondition.type === 'times') {
        formData.scheduleConfig.endCondition.times = sc.endCondition.times;
      }
      else if (sc.endCondition.type === 'date' && sc.endCondition.date) {
        // Convert date to YYYY-MM-DD format for input[type="date"]
        const date = new Date(sc.endCondition.date);
        formData.scheduleConfig.endCondition.date = date; // Store as Date object
      }
    }
  }

  // Handle reminderConfig
  if (props.task.reminderConfig?.reminders) {
    formData.reminders = props.task.reminderConfig.reminders.map(r => ({ ...r }));
  }

  // Handle defaultAssigneeIds
  if (props.task.defaultAssigneeIds) {
    formData.defaultAssigneeIds = [...props.task.defaultAssigneeIds];
  }
};

// Form validation
const validateForm = () => {
  // Reset validation error
  validationError.value = '';

  // Basic required field validation
  if (!formData.name.trim()) {
    validationError.value = 'Task name is required.';
    return false;
  }

  if (!formData.categoryId) {
    validationError.value = 'Category is required.';
    return false;
  }

  // Schedule validation
  const sc = formData.scheduleConfig;

  if (sc.type === 'fixed_interval') {
    if (!sc.interval || sc.interval < 1) {
      validationError.value = 'Interval must be at least 1.';
      return false;
    }
  }
  else if (sc.type === 'specific_days_of_week') {
    const hasDaySelected = Object.values(sc.daysOfWeek).some(day => day);
    if (!hasDaySelected) {
      validationError.value = 'Please select at least one day of the week.';
      return false;
    }
  }
  else if (sc.type === 'specific_day_of_month') {
    if (!sc.dayOfMonth || sc.dayOfMonth < 1 || sc.dayOfMonth > 31) {
      validationError.value = 'Day of month must be between 1 and 31.';
      return false;
    }
  }
  else if (sc.type === 'variable_interval') {
    if (!sc.variableInterval.interval || sc.variableInterval.interval < 1) {
      validationError.value = 'Variable interval must be at least 1.';
      return false;
    }
  }
  else if (sc.type === 'annual_fixed' || sc.type === 'annual_variable') {
    if (!sc.month || sc.month < 1 || sc.month > 12) {
      validationError.value = 'Month must be between 1 and 12.';
      return false;
    }
    if (!sc.dayOfMonth || sc.dayOfMonth < 1 || sc.dayOfMonth > 31) {
      validationError.value = 'Day of month must be between 1 and 31.';
      return false;
    }
  }

  // End condition validation
  if (sc.endCondition.type === 'times') {
    if (!sc.endCondition.times || sc.endCondition.times < 1) {
      validationError.value = 'Number of times must be at least 1.';
      return false;
    }
  }
  else if (sc.endCondition.type === 'date') {
    if (!sc.endCondition.date) {
      validationError.value = 'End date is required.';
      return false;
    }

    const endDate = new Date(sc.endCondition.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (endDate < today) {
      validationError.value = 'End date cannot be in the past.';
      return false;
    }
  }

  return true;
};

// Form submission
const handleSubmit = async () => {
  // Validate form
  if (!validateForm()) {
    return;
  }

  try {
    isSubmitting.value = true;

    // Prepare submission data
    // Explicitly type submissionData to allow optional id
    const submissionData: Partial<TaskDefinition> & { id?: string } = {
      name: formData.name,
      categoryId: formData.categoryId,
      description: formData.description ?? undefined, // Use ?? undefined
      instructions: formData.instructions ?? undefined, // Use ?? undefined
      // Deep copy schedule config to avoid modifying reactive formData directly
      scheduleConfig: JSON.parse(JSON.stringify(formData.scheduleConfig)),
      reminderConfig: (() => {
        const unique = formData.reminders.filter((r, i, arr) =>
          arr.findIndex(o => o.timing === r.timing && o.days === r.days) === i
        );
        return unique.length > 0 ? { reminders: unique.map(r => ({ ...r })) } : undefined;
      })(),
      defaultAssigneeIds: formData.defaultAssigneeIds
    };

    // If editing, include task ID
    if (props.task) {
      submissionData.id = props.task.id;
    }

    // Date is already a Date object or undefined from formData, no conversion needed here.
    // Add check for scheduleConfig existence before accessing endCondition
    if (submissionData.scheduleConfig?.endCondition?.type === 'date' &&
      submissionData.scheduleConfig.endCondition.date instanceof Date) {
      // Optional: Ensure it's a valid date if needed, but type is already Date | undefined
    }

    // Emit submit event with form data
    emit('submit', submissionData);
  } catch (err) {
    console.error('Form submission error:', err);
    validationError.value = 'An error occurred while submitting the form. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
};

// --- Reminder helpers ---
const addReminder = () => {
  if (formData.reminders.length >= 5) return;
  formData.reminders.push({ days: 1, timing: 'before' });
};

const removeReminder = (index: number) => {
  formData.reminders.splice(index, 1);
};

const onTimingChange = (index: number) => {
  if (formData.reminders[index].timing === 'on') {
    formData.reminders[index].days = 0;
  }
};
</script>
