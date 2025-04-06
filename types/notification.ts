// types/notification.ts
export interface NotificationPreferences {
  // Task notifications
  task_created: 'any' | 'none';
  task_paused: 'any' | 'none';
  task_completed: 'any' | 'none';
  task_deleted: 'any' | 'none';
  
  // Occurrence notifications
  occurrence_assigned: 'any' | 'mine' | 'none';
  occurrence_executed: 'any' | 'mine' | 'none';
  occurrence_skipped: 'any' | 'mine' | 'none';
  occurrence_commented: 'any' | 'mine' | 'none';
}

export const defaultNotificationPreferences: NotificationPreferences = {
  // Task notifications - defaults to 'any'
  task_created: 'any',
  task_paused: 'any',
  task_completed: 'any',
  task_deleted: 'any',
  
  // Occurrence notifications - defaults to 'mine'
  occurrence_assigned: 'mine',
  occurrence_executed: 'mine',
  occurrence_skipped: 'mine',
  occurrence_commented: 'mine'
};
