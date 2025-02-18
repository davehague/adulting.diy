<template>
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg max-w-lg w-full p-6 space-y-6">
            <h3 class="text-lg font-medium text-gray-900">Set Recurrence Pattern</h3>

            <div class="space-y-6">
                <!-- Recurrence Type -->
                <div>
                    <label class="block text-sm font-medium text-gray-700">Repeat</label>
                    <select v-model="type"
                        class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="monthly_by_weekday">Monthly by weekday</option>
                        <option value="yearly">Yearly</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>

                <!-- Interval -->
                <div class="flex items-center space-x-3">
                    <label class="text-sm font-medium text-gray-700">Every</label>
                    <input v-model="interval" type="number" min="1"
                        class="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    <span class="text-sm text-gray-600">{{ type }}(s)</span>
                </div>

                <!-- Scheduling Type -->
                <div>
                    <label class="block text-sm font-medium text-gray-700">Scheduling Type</label>
                    <select v-model="schedulingType"
                        class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="fixed">Fixed dates</option>
                        <option value="variable">Based on completion</option>
                    </select>
                </div>

                <!-- Days of Week -->
                <div v-if="showDaysOfWeek" class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700">On these days</label>
                    <div class="grid grid-cols-7 gap-2">
                        <label v-for="day in ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']" :key="day"
                            class="flex flex-col items-center space-y-1">
                            <input type="checkbox" :value="day" v-model="daysOfWeek"
                                class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                            <span class="text-xs text-gray-600">{{ day }}</span>
                        </label>
                    </div>
                </div>

                <!-- Monthly by Weekday options -->
                <div v-if="showMonthlyOptions" class="flex items-center space-x-3">
                    <label class="text-sm font-medium text-gray-700">On the</label>
                    <select v-model="weekOfMonth"
                        class="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option :value="1">First</option>
                        <option :value="2">Second</option>
                        <option :value="3">Third</option>
                        <option :value="4">Fourth</option>
                        <option :value="-1">Last</option>
                    </select>
                    <select v-model="weekday"
                        class="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="SU">Sunday</option>
                        <option value="MO">Monday</option>
                        <option value="TU">Tuesday</option>
                        <option value="WE">Wednesday</option>
                        <option value="TH">Thursday</option>
                        <option value="FR">Friday</option>
                        <option value="SA">Saturday</option>
                    </select>
                </div>

                <!-- End Conditions -->
                <div class="space-y-3">
                    <label class="block text-sm font-medium text-gray-700">Ends</label>
                    <select v-model="endType"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="never">Never</option>
                        <option value="after">After</option>
                        <option value="on_date">On date</option>
                    </select>

                    <div v-if="endType === 'after'" class="flex items-center space-x-3">
                        <input v-model="endAfterOccurrences" type="number" min="1"
                            class="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                        <span class="text-sm text-gray-600">occurrences</span>
                    </div>

                    <input v-if="endType === 'on_date'" v-model="endDate" type="date"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end space-x-3 pt-6 border-t">
                <button @click="emit('close')"
                    class="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                    Cancel
                </button>
                <button @click="handleSave"
                    class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                    Save
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { type RecurrencePattern } from '@/types/tasks'

const props = defineProps<{
    pattern?: RecurrencePattern | null
}>()

const emit = defineEmits<{
    select: [pattern: RecurrencePattern]
    close: []
}>()

const type = ref(props.pattern?.type || 'daily')
const interval = ref(props.pattern?.interval || 1)
const schedulingType = ref(props.pattern?.scheduling_type || 'fixed')
const daysOfWeek = ref(props.pattern?.days_of_week || [])
const weekday = ref(props.pattern?.weekday || 'MO')
const weekOfMonth = ref(props.pattern?.week_of_month || 1)
const endType = ref(props.pattern?.end_type || 'never')
const endAfterOccurrences = ref(props.pattern?.end_after_occurrences || 0)
const endDate = ref(props.pattern?.end_date || '')

const showDaysOfWeek = computed(() =>
    type.value === 'weekly' || (type.value === 'custom' && interval.value > 0)
)

const showMonthlyOptions = computed(() =>
    type.value === 'monthly_by_weekday'
)

const handleSave = () => {
    const pattern: RecurrencePattern = {
        id: props.pattern?.id || '',  // Will be set by backend for new patterns
        type: type.value,
        interval: interval.value,
        scheduling_type: schedulingType.value,
        end_type: endType.value,
        created_at: props.pattern?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
    }

    if (showDaysOfWeek.value) {
        pattern.days_of_week = daysOfWeek.value
    }

    if (showMonthlyOptions.value) {
        pattern.weekday = weekday.value
        pattern.week_of_month = weekOfMonth.value
    }

    if (endType.value === 'after') {
        pattern.end_after_occurrences = endAfterOccurrences.value
    } else if (endType.value === 'on_date') {
        pattern.end_date = endDate.value
    }

    emit('select', pattern)
}
</script>