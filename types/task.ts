// types/task.ts
import type { Category } from "."; // Import Category via index barrel file
import type { User } from "./user"; // Import User type
export type TaskMetaStatus = "active" | "paused" | "soft-deleted" | "completed";

export type RecurrenceType =
  | "once"
  | "fixed_interval"
  | "specific_days_of_week"
  | "specific_day_of_month"
  | "specific_weekday_of_month"
  | "variable_interval";

export type IntervalUnit = "day" | "week" | "month" | "year";

export type EndConditionType = "never" | "times" | "date";

export interface EndCondition {
  type: EndConditionType;
  times?: number;
  date?: Date;
}

export interface DaysOfWeek {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

// Base interface for common properties
interface BaseScheduleConfig {
  endCondition: EndCondition;
}

// Specific interfaces for each recurrence type
export interface OnceScheduleConfig extends BaseScheduleConfig {
  type: "once";
}

export interface FixedIntervalScheduleConfig extends BaseScheduleConfig {
  type: "fixed_interval";
  interval: number;
  intervalUnit: IntervalUnit;
}

export interface SpecificDaysScheduleConfig extends BaseScheduleConfig {
  type: "specific_days_of_week";
  daysOfWeek: DaysOfWeek;
}

export interface SpecificDayOfMonthScheduleConfig extends BaseScheduleConfig {
  type: "specific_day_of_month";
  dayOfMonth: number;
}

export interface SpecificWeekdayOfMonthScheduleConfig
  extends BaseScheduleConfig {
  type: "specific_weekday_of_month";
  weekdayOfMonth: {
    weekday:
      | "monday"
      | "tuesday"
      | "wednesday"
      | "thursday"
      | "friday"
      | "saturday"
      | "sunday";
    occurrence: "first" | "second" | "third" | "fourth" | "last";
  };
}

export interface VariableIntervalScheduleConfig extends BaseScheduleConfig {
  type: "variable_interval";
  variableInterval: {
    interval: number;
    unit: IntervalUnit;
  };
}

// Discriminated Union Type
export type ScheduleConfig =
  | OnceScheduleConfig
  | FixedIntervalScheduleConfig
  | SpecificDaysScheduleConfig
  | SpecificDayOfMonthScheduleConfig
  | SpecificWeekdayOfMonthScheduleConfig
  | VariableIntervalScheduleConfig;

export interface ReminderConfig {
  initialReminder?: number; // Days before due date
  followUpReminder?: number; // Days before due date
  overdueReminder?: number; // Days after due date
}

export interface TaskDefinition {
  id: string;
  household_id: string;
  name: string;
  description?: string;
  instructions?: string;
  category_id: string;
  meta_status: TaskMetaStatus;
  schedule_config: ScheduleConfig;
  reminder_config?: ReminderConfig;
  created_at: Date;
  updated_at: Date;
  created_by_user_id: string;
  default_assignee_ids?: string[];
  category?: Category; // Add optional category if needed by TaskDefinition usage
}

export type OccurrenceStatus =
  | "created"
  | "assigned"
  | "completed"
  | "skipped"
  | "deleted";

export interface TaskOccurrence {
  id: string;
  taskId: string; // Renamed from task_id
  dueDate: Date; // Renamed from due_date
  status: OccurrenceStatus;
  assigneeIds: string[]; // Renamed from assignee_ids
  completedAt?: Date; // Renamed from completed_at
  skippedAt?: Date; // Renamed from skipped_at
  createdAt: Date; // Renamed from created_at
  user?: User;
  updatedAt: Date; // Renamed from updated_at
  task?: TaskDefinition;
}

export type HistoryLogType =
  | "status_change"
  | "comment"
  | "assignment_change"
  | "date_change";

export interface OccurrenceHistoryLog {
  id: string;
  occurrenceId: string; // Use camelCase
  userId: string; // Use camelCase
  logType: HistoryLogType; // Use camelCase
  oldValue?: string; // Use camelCase
  newValue?: string; // Use camelCase
  comment?: string;
  createdAt: Date; // Use camelCase
  user?: User; // Add optional user based on service include
}
