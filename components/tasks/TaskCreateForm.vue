<template>
    <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Name Field -->
        <div>
            <label for="name" class="block text-sm font-medium text-gray-700">Name*</label>
            <input id="name" v-model="formData.name" type="text" required
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Task name" />
        </div>

        <!-- Category Field -->
        <div>
            <label for="categoryId" class="block text-sm font-medium text-gray-700">Category*</label>
            <select id="categoryId" v-model="formData.categoryId" required
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <option disabled value="">Select a category</option>
                <option v-for="category in categories" :key="category.id" :value="category.id">
                    {{ category.name }}
                </option>
            </select>
        </div>

        <!-- Description Field -->
        <div>
            <label for="description" class="block text-sm font-medium text-gray-700">Description</label>
            <textarea id="description" v-model="formData.description" rows="3"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Optional task description"></textarea>
        </div>

        <!-- Instructions Field -->
        <div>
            <label for="instructions" class="block text-sm font-medium text-gray-700">Instructions</label>
            <textarea id="instructions" v-model="formData.instructions" rows="4"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Step-by-step instructions for completing this task"></textarea>
        </div>

        <!-- Schedule Configuration -->
        <div class="border rounded-md p-4 bg-gray-50">
            <h3 class="text-lg font-medium text-gray-700 mb-4">Schedule Configuration</h3>

            <!-- Schedule Type -->
            <div class="mb-4">
                <label for="scheduleType" class="block text-sm font-medium text-gray-700">Schedule Type*</label>
                <select id="scheduleType" v-model="formData.scheduleConfig.type" required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="once">One Time</option>
                    <option value="fixed_interval">Fixed Interval</option>
                    <option value="specific_days_of_week">Specific Days of Week</option>
                    <option value="specific_day_of_month">Specific Day of Month</option>
                    <option value="specific_weekday_of_month">Specific Weekday of Month</option>
                    <option value="variable_interval">Variable Interval (After Completion)</option>
                </select>
            </div>

            <!-- Due Date for 'Once' Type -->
            <div v-if="formData.scheduleConfig.type === 'once'" class="mb-4">
                <label for="onceDueDate" class="block text-sm font-medium text-gray-700">Due Date*</label>
                <input id="onceDueDate" v-model="formData.scheduleConfig.dueDate" type="date" required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>

            <!-- Fixed Interval Options -->
            <div v-if="formData.scheduleConfig.type === 'fixed_interval'" class="mb-4 grid grid-cols-2 gap-4">
                <div>
                    <label for="interval" class="block text-sm font-medium text-gray-700">Interval*</label>
                    <input id="interval" v-model.number="formData.scheduleConfig.interval" type="number" min="1"
                        required
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                    <label for="intervalUnit" class="block text-sm font-medium text-gray-700">Unit*</label>
                    <select id="intervalUnit" v-model="formData.scheduleConfig.intervalUnit" required
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <option value="day">Day(s)</option>
                        <option value="week">Week(s)</option>
                        <option value="month">Month(s)</option>
                        <option value="year">Year(s)</option>
                    </select>
                </div>
            </div>

            <!-- Specific Days of Week Options -->
            <div v-if="formData.scheduleConfig.type === 'specific_days_of_week'" class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Days of Week*</label>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div v-for="day in daysOfWeek" :key="day.value">
                        <label class="inline-flex items-center">
                            <input type="checkbox" :checked="isDayChecked(day.value)"
                                @change="updateDayChecked(day.value, ($event.target as HTMLInputElement).checked)"
                                class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" />
                            <span class="ml-2">{{ day.label }}</span>
                        </label>
                    </div>
                </div>
            </div>

            <!-- Specific Day of Month Options -->
            <div v-if="formData.scheduleConfig.type === 'specific_day_of_month'" class="mb-4">
                <label for="dayOfMonth" class="block text-sm font-medium text-gray-700">Day of Month*</label>
                <input id="dayOfMonth" v-model.number="formData.scheduleConfig.dayOfMonth" type="number" min="1"
                    max="31" required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>

            <!-- Specific Weekday of Month Options -->
            <div v-if="formData.scheduleConfig.type === 'specific_weekday_of_month'"
                class="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label for="weekdayOccurrence" class="block text-sm font-medium text-gray-700">Occurrence*</label>
                    <select id="weekdayOccurrence" v-model="formData.scheduleConfig.weekdayOfMonth!.occurrence" required
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <option value="first">First</option>
                        <option value="second">Second</option>
                        <option value="third">Third</option>
                        <option value="fourth">Fourth</option>
                        <option value="last">Last</option>
                    </select>
                </div>
                <div>
                    <label for="weekday" class="block text-sm font-medium text-gray-700">Weekday*</label>
                    <select id="weekday" v-model="formData.scheduleConfig.weekdayOfMonth!.weekday" required
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <option v-for="day in daysOfWeek" :key="day.value" :value="day.value">
                            {{ day.label }}
                        </option>
                    </select>
                </div>
            </div>

            <!-- Variable Interval Options -->
            <div v-if="formData.scheduleConfig.type === 'variable_interval'" class="mb-4 grid grid-cols-2 gap-4">
                <div>
                    <label for="variableInterval" class="block text-sm font-medium text-gray-700">Interval*</label>
                    <input id="variableInterval" v-model.number="formData.scheduleConfig.variableInterval!.interval"
                        type="number" min="1" required
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                    <label for="variableUnit" class="block text-sm font-medium text-gray-700">Unit*</label>
                    <select id="variableUnit" v-model="formData.scheduleConfig.variableInterval!.unit" required
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <option value="day">Day(s)</option>
                        <option value="week">Week(s)</option>
                        <option value="month">Month(s)</option>
                        <option value="year">Year(s)</option>
                    </select>
                </div>
            </div>

            <!-- End Condition -->
            <div class="mb-4">
                <label for="endConditionType" class="block text-sm font-medium text-gray-700">End Condition*</label>
                <select id="endConditionType" v-model="formData.scheduleConfig.endCondition.type" required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="never">Never (Run indefinitely)</option>
                    <option value="times">After specified number of times</option>
                    <option value="date">Until specified date</option>
                </select>
            </div>

            <!-- End Condition Options -->
            <div v-if="formData.scheduleConfig.endCondition.type === 'times'" class="mb-4">
                <label for="endTimes" class="block text-sm font-medium text-gray-700">Number of Times*</label>
                <input id="endTimes" v-model.number="formData.scheduleConfig.endCondition.times" type="number" min="1"
                    required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>

            <div v-if="formData.scheduleConfig.endCondition.type === 'date'" class="mb-4">
                <label for="endDate" class="block text-sm font-medium text-gray-700">End Date*</label>
                <input id="endDate" v-model="formData.scheduleConfig.endCondition.date" type="date" required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
        </div>

        <!-- Reminder Configuration -->
        <div class="border rounded-md p-4 bg-gray-50">
            <h3 class="text-lg font-medium text-gray-700 mb-4">Reminder Configuration</h3>

            <!-- Initial Reminder -->
            <div class="mb-4">
                <label for="initialReminder" class="block text-sm font-medium text-gray-700">Initial Reminder (days
                    before)</label>
                <input id="initialReminder" v-model.number="formData.reminderConfig.initialReminder" type="number"
                    min="0"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Optional" />
            </div>

            <!-- Follow-up Reminder -->
            <div class="mb-4">
                <label for="followUpReminder" class="block text-sm font-medium text-gray-700">Follow-up Reminder (days
                    before)</label>
                <input id="followUpReminder" v-model.number="formData.reminderConfig.followUpReminder" type="number"
                    min="0"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Optional" />
            </div>

            <!-- Overdue Reminder -->
            <div>
                <label for="overdueReminder" class="block text-sm font-medium text-gray-700">Overdue Reminder (days
                    after)</label>
                <input id="overdueReminder" v-model.number="formData.reminderConfig.overdueReminder" type="number"
                    min="0"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Optional" />
            </div>
        </div>

        <!-- Default Assignees -->
        <div class="border rounded-md p-4 bg-gray-50">
            <h3 class="text-lg font-medium text-gray-700 mb-4">Default Assignees (Optional)</h3>
            <div v-if="householdUsers.length > 0" class="space-y-2 max-h-40 overflow-y-auto">
                <div v-for="user in householdUsers" :key="user.id">
                    <label class="inline-flex items-center">
                        <input type="checkbox" :value="user.id" v-model="formData.defaultAssigneeIds"
                            class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" />
                        <span class="ml-2">{{ user.name }} ({{ user.email }})</span>
                    </label>
                </div>
            </div>
            <p v-else class="text-sm text-gray-500">Loading users or no other users found in the household.</p>
        </div>

        <!-- Form Buttons -->
        <div class="flex justify-end space-x-3">
            <NuxtLink :to="cancelUrl"
                class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Cancel
            </NuxtLink>
            <button type="submit"
                class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                :disabled="isSubmitting">
                {{ isSubmitting ? 'Creating...' : submitButtonText }}
            </button>
        </div>

        <!-- Validation Errors -->
        <div v-if="validationError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p>{{ validationError }}</p>
        </div>
    </form>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'; // Removed computed as it wasn't used
import { useApi } from '@/utils/api';
import type {
    Category,
    ScheduleConfig,
    ReminderConfig,
    DaysOfWeek,
    SpecificDaysScheduleConfig,
    User,
    OnceScheduleConfig, // Import OnceScheduleConfig
    EndCondition // Import EndCondition
} from '@/types';

// Props
interface Props {
    submitButtonText?: string;
    cancelUrl?: string;
}

const props = withDefaults(defineProps<Props>(), {
    submitButtonText: 'Create Task',
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
const householdUsers = ref<Pick<User, 'id' | 'name' | 'email'>[]>([]);
const isSubmitting = ref(false);
const validationError = ref('');

// Define a simpler interface for form data, making all schedule-specific props optional
// This allows easier handling with v-model and type narrowing in templates/validation
interface TaskFormData {
    name: string;
    categoryId: string;
    description: string;
    instructions: string;
    scheduleConfig: {
        type: ScheduleConfig['type'];
        // All possible properties from ScheduleConfig variants, optional
        dueDate?: string; // string for input
        interval?: number;
        intervalUnit?: ScheduleConfig extends { intervalUnit: any } ? ScheduleConfig['intervalUnit'] : 'day'; // Provide default for init
        daysOfWeek?: DaysOfWeek;
        dayOfMonth?: number;
        weekdayOfMonth?: ScheduleConfig extends { weekdayOfMonth: any } ? ScheduleConfig['weekdayOfMonth'] : { weekday: 'monday', occurrence: 'first' }; // Provide default for init
        variableInterval?: ScheduleConfig extends { variableInterval: any } ? ScheduleConfig['variableInterval'] : { interval: 1, unit: 'day' }; // Provide default for init
        endCondition: {
            type: EndCondition['type'];
            times?: number;
            date?: string; // string for input
        };
    };
    reminderConfig: ReminderConfig;
    defaultAssigneeIds: string[];
}

// Form data structure (default values for creation)
// Initialize with defaults matching the 'once' type initially
const formData = reactive<TaskFormData>({
    name: '',
    categoryId: '',
    description: '',
    instructions: '',
    scheduleConfig: {
        type: 'once',
        dueDate: new Date().toISOString().split('T')[0], // Default string date
        interval: 1,
        intervalUnit: 'day', // Default value matching interface fallback
        daysOfWeek: { monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false },
        dayOfMonth: 1,
        weekdayOfMonth: { weekday: 'monday', occurrence: 'first' }, // Default value
        variableInterval: { interval: 1, unit: 'day' }, // Default value matching interface fallback
        endCondition: {
            type: 'never',
            times: undefined,
            date: undefined // Default string date
        }
    },
    reminderConfig: {
        initialReminder: undefined,
        followUpReminder: undefined,
        overdueReminder: undefined
    },
    defaultAssigneeIds: []
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

// Type alias for day keys
type DayKey = keyof DaysOfWeek;

// Helper function to check if a day is checked
const isDayChecked = (dayValue: string): boolean => {
    if (formData.scheduleConfig.type === 'specific_days_of_week' && formData.scheduleConfig.daysOfWeek) {
        return !!formData.scheduleConfig.daysOfWeek[dayValue as DayKey];
    }
    return false;
};

// Helper function to update the checked state of a day
const updateDayChecked = (dayValue: string, checked: boolean) => {
    if (formData.scheduleConfig.type === 'specific_days_of_week') {
        // Ensure daysOfWeek object exists before assigning
        if (!formData.scheduleConfig.daysOfWeek) {
            formData.scheduleConfig.daysOfWeek = { monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false };
        }
        formData.scheduleConfig.daysOfWeek[dayValue as DayKey] = checked;
    }
};

// Load data
onMounted(async () => {
    try {
        // Fetch categories
        const categoriesData = await api.get<Category[]>('/api/categories');
        categories.value = categoriesData;
    } catch (err) {
        console.error('Error fetching categories:', err);
        validationError.value = 'Failed to load categories. Please try refreshing the page.';
    }

    try {
        // Fetch household users
        const usersData = await api.get<Pick<User, 'id' | 'name' | 'email'>[]>('/api/household/users');
        householdUsers.value = usersData;
    } catch (err) {
        console.error('Error fetching household users:', err);
        // Non-critical error, form can still function
    }
});

// Form validation
const validateForm = () => {
    validationError.value = '';
    const sc = formData.scheduleConfig;

    if (!formData.name.trim()) {
        validationError.value = 'Task name is required.'; return false;
    }
    if (!formData.categoryId) {
        validationError.value = 'Category is required.'; return false;
    }

    // Schedule validation based on type
    if (sc.type === 'once') {
        if (!sc.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(sc.dueDate)) {
            validationError.value = 'Due date (YYYY-MM-DD) is required for one-time tasks.'; return false;
        }
    } else if (sc.type === 'fixed_interval') {
        // Use type assertion here as TS can now narrow based on sc.type check
        const fixedConfig = sc as TaskFormData['scheduleConfig'] & { type: 'fixed_interval' };
        if (!fixedConfig.interval || fixedConfig.interval < 1) { validationError.value = 'Interval must be at least 1.'; return false; }
        if (!fixedConfig.intervalUnit) { validationError.value = 'Interval unit is required.'; return false; }
    } else if (sc.type === 'specific_days_of_week') {
        const daysConfig = sc as TaskFormData['scheduleConfig'] & { type: 'specific_days_of_week' };
        const selectedDays = Object.values(daysConfig.daysOfWeek || {}).filter(Boolean);
        if (selectedDays.length === 0) { validationError.value = 'At least one day must be selected for weekly schedule.'; return false; }
    } else if (sc.type === 'specific_day_of_month') {
        const dayMonthConfig = sc as TaskFormData['scheduleConfig'] & { type: 'specific_day_of_month' };
        if (!dayMonthConfig.dayOfMonth || dayMonthConfig.dayOfMonth < 1 || dayMonthConfig.dayOfMonth > 31) { validationError.value = 'Day of month must be between 1 and 31.'; return false; }
    } else if (sc.type === 'specific_weekday_of_month') {
        const weekdayMonthConfig = sc as TaskFormData['scheduleConfig'] & { type: 'specific_weekday_of_month' };
        if (!weekdayMonthConfig.weekdayOfMonth?.occurrence || !weekdayMonthConfig.weekdayOfMonth?.weekday) { validationError.value = 'Both occurrence and weekday are required for this schedule type.'; return false; }
    } else if (sc.type === 'variable_interval') {
        const variableConfig = sc as TaskFormData['scheduleConfig'] & { type: 'variable_interval' };
        if (!variableConfig.variableInterval?.interval || variableConfig.variableInterval.interval < 1) { validationError.value = 'Variable interval must be at least 1.'; return false; }
        if (!variableConfig.variableInterval?.unit) { validationError.value = 'Variable interval unit is required.'; return false; }
    }

    // End condition validation
    const ec = sc.endCondition;
    if (ec.type === 'times') {
        if (!ec.times || ec.times < 1) { validationError.value = 'Number of times must be at least 1.'; return false; }
    } else if (ec.type === 'date') {
        if (!ec.date || !/^\d{4}-\d{2}-\d{2}$/.test(ec.date)) { validationError.value = 'End date (YYYY-MM-DD) is required.'; return false; }
    }

    // Reminder validation
    const rc = formData.reminderConfig;
    if (rc.initialReminder !== undefined && (typeof rc.initialReminder !== 'number' || rc.initialReminder < 0)) { validationError.value = 'Initial reminder must be a non-negative number.'; return false; }
    if (rc.followUpReminder !== undefined && (typeof rc.followUpReminder !== 'number' || rc.followUpReminder < 0)) { validationError.value = 'Follow-up reminder must be a non-negative number.'; return false; }
    if (rc.overdueReminder !== undefined && (typeof rc.overdueReminder !== 'number' || rc.overdueReminder < 0)) { validationError.value = 'Overdue reminder must be a non-negative number.'; return false; }

    return true; // Form is valid
};

// Handle form submission
const handleSubmit = () => {
    if (!validateForm()) {
        return; // Stop submission if validation fails
    }

    isSubmitting.value = true;
    validationError.value = '';

    // Prepare data to submit, ensuring correct types for ScheduleConfig
    let finalScheduleConfig: ScheduleConfig;

    // Base end condition handling (convert date string to Date object)
    const baseEndCondition: EndCondition = {
        type: formData.scheduleConfig.endCondition.type,
        times: formData.scheduleConfig.endCondition.times,
        // Convert date string to Date object only if type is 'date' and date is provided
        date: (formData.scheduleConfig.endCondition.type === 'date' && formData.scheduleConfig.endCondition.date)
            ? new Date(formData.scheduleConfig.endCondition.date + 'T00:00:00') // Use T00:00:00 for consistency
            : undefined
    };
    // Clean up unused end condition properties
    if (baseEndCondition.type !== 'times') delete baseEndCondition.times;
    if (baseEndCondition.type !== 'date') delete baseEndCondition.date;


    // Construct the specific schedule config based on type
    switch (formData.scheduleConfig.type) {
        case 'once':
            finalScheduleConfig = {
                type: 'once',
                dueDate: new Date(formData.scheduleConfig.dueDate! + 'T00:00:00'), // Convert string to Date
                endCondition: baseEndCondition
            };
            break;
        case 'fixed_interval':
            finalScheduleConfig = {
                type: 'fixed_interval',
                interval: formData.scheduleConfig.interval!,
                intervalUnit: formData.scheduleConfig.intervalUnit!,
                endCondition: baseEndCondition
            };
            break;
        case 'specific_days_of_week':
            finalScheduleConfig = {
                type: 'specific_days_of_week',
                daysOfWeek: formData.scheduleConfig.daysOfWeek!,
                endCondition: baseEndCondition
            };
            break;
        case 'specific_day_of_month':
            finalScheduleConfig = {
                type: 'specific_day_of_month',
                dayOfMonth: formData.scheduleConfig.dayOfMonth!,
                endCondition: baseEndCondition
            };
            break;
        case 'specific_weekday_of_month':
            finalScheduleConfig = {
                type: 'specific_weekday_of_month',
                weekdayOfMonth: formData.scheduleConfig.weekdayOfMonth!,
                endCondition: baseEndCondition
            };
            break;
        case 'variable_interval':
            finalScheduleConfig = {
                type: 'variable_interval',
                variableInterval: formData.scheduleConfig.variableInterval!,
                endCondition: baseEndCondition
            };
            break;
        default:
            // Should not happen with proper validation
            console.error('Invalid schedule type during submission');
            isSubmitting.value = false;
            validationError.value = 'Invalid schedule configuration.';
            return;
    }

    // Prepare the final data object to emit
    const dataToSubmit = {
        name: formData.name,
        categoryId: formData.categoryId,
        description: formData.description,
        instructions: formData.instructions,
        scheduleConfig: finalScheduleConfig, // Use the correctly typed and processed config
        reminderConfig: { ...formData.reminderConfig }, // Clone reminder config
        defaultAssigneeIds: [...formData.defaultAssigneeIds] // Clone assignees array
    };

    // Emit the submit event
    emit('submit', dataToSubmit);

    // Reset submitting state (assuming parent component handles actual API call and success/error)
    // If this component were making the API call directly, you'd handle the promise here.
    // For now, we assume the parent handles the async logic.
    // isSubmitting.value = false; // Potentially reset later by parent or on success/error event
};

</script>