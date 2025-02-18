export interface Task {
  id: string;
  organization_id: string; // FK to organizations table
  title: string;
  description?: string;

  initial_reminder: number; // Days before due date
  follow_up_reminder: number; // Days before due date
  overdue_reminder: number; // Days after due date

  recurring: boolean;
  recurrence_pattern_id?: string; // FK to recurrence_patterns table

  is_active: boolean;

  created_by: string; // FK to users table
  created_at: string;
  updated_at: string;
}

export interface RecurrencePattern {
  id: string;
  type:
    | "daily"
    | "weekly"
    | "monthly"
    | "monthly_by_weekday"
    | "yearly"
    | "custom";
  interval: number; // every X days/weeks/months/years
  scheduling_type: "fixed" | "variable";

  // For weekly or custom with weekly pattern
  days_of_week?: string[]; // Array of "SU", "MO", etc.

  // For monthly_by_weekday
  weekday?: string; // "SU", "MO", etc.
  week_of_month?: number; // 1,2,3,4,-1 (last)

  // End conditions
  end_type: "never" | "after" | "on_date";
  end_after_occurrences?: number;
  end_date?: string;

  created_at: string;
  updated_at: string;
}

export interface TaskOccurrence {
  id: string;
  task_id: string;
  due_date: string;
  status: "pending" | "completed" | "overdue" | "skipped" | "in_progress";

  assigned_to: string[]; // FK to users table
  executed_by: string | null; // FK to users table
  executed_datetime?: string;
  execution_notes?: string;

  created_at: string;
  updated_at: string;
}

export interface TaskOccurrenceNotification {
  id: string;
  task_occurrence_id: string; // FK to task_occurrences table
  type: "initial" | "follow_up" | "overdue";
  sent_at: string | null;
  scheduled_for: string;

  created_at: string;
  updated_at: string;
}
