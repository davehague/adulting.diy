import type { User, Household, TaskDefinition, TaskOccurrence, Category } from '@/types'

export const testUsers = {
  admin: {
    id: 'user-admin-123',
    email: 'admin@test.com',
    name: 'Admin User',
    isAdmin: true,
    householdId: 'household-123',
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date(),
  } as User,

  member: {
    id: 'user-member-456',
    email: 'member@test.com', 
    name: 'Member User',
    isAdmin: false,
    householdId: 'household-123',
    createdAt: new Date('2024-01-02'),
    lastLogin: new Date(),
  } as User,

  outsider: {
    id: 'user-outsider-789',
    email: 'outsider@test.com',
    name: 'Outsider User', 
    isAdmin: false,
    householdId: 'household-456',
    createdAt: new Date('2024-01-03'),
    lastLogin: new Date(),
  } as User,
}

export const testHousehold = {
  id: 'household-123',
  name: 'Test Household',
  inviteCode: 'TEST123',
  createdAt: new Date('2024-01-01'),
  createdByUserId: testUsers.admin.id,
} as Household

export const testCategories = {
  cleaning: {
    id: 'cat-cleaning-123',
    name: 'Cleaning',
    icon: '🧹',
    isPredefined: true,
    householdId: null,
  } as Category,

  custom: {
    id: 'cat-custom-456', 
    name: 'Custom Category',
    icon: '⭐',
    isPredefined: false,
    householdId: testHousehold.id,
  } as Category,
}

export const testTaskDefinitions = {
  onceTask: {
    id: 'task-once-123',
    name: 'One Time Task',
    description: 'A task that happens only once',
    instructions: 'Complete this task',
    categoryId: testCategories.cleaning.id,
    category: testCategories.cleaning,
    householdId: testHousehold.id,
    createdByUserId: testUsers.admin.id,
    defaultAssigneeIds: [testUsers.member.id],
    metaStatus: 'active' as const,
    scheduleConfig: {
      type: 'once',
      startDate: new Date('2024-02-01'),
    },
    reminderConfig: {
      initialReminderDays: 1,
      followUpReminderDays: 0,
      overdueReminderDays: 1,
    },
    recurrencePattern: {
      type: 'once',
      startDate: new Date('2024-02-01'),
      endCondition: { type: 'never' }
    },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  } as TaskDefinition,

  weeklyTask: {
    id: 'task-weekly-456',
    name: 'Weekly Cleaning',
    description: 'Clean the house weekly',
    categoryId: testCategories.cleaning.id,
    category: testCategories.cleaning,
    householdId: testHousehold.id,
    createdByUserId: testUsers.admin.id,
    defaultAssigneeIds: [testUsers.member.id],
    metaStatus: 'active' as const,
    scheduleConfig: {
      type: 'fixed_interval',
      intervalValue: 1,
      intervalUnit: 'weeks',
      startDate: new Date('2024-01-01'),
    },
    recurrencePattern: {
      type: 'fixed_interval',
      intervalValue: 1,
      intervalUnit: 'weeks',
      startDate: new Date('2024-01-01'),
      endCondition: { type: 'never' }
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as TaskDefinition,
}

export const testOccurrences = {
  pending: {
    id: 'occ-pending-123',
    taskId: testTaskDefinitions.weeklyTask.id,
    task: testTaskDefinitions.weeklyTask,
    dueDate: new Date('2024-02-05'),
    status: 'assigned' as const,
    assigneeIds: [testUsers.member.id],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as TaskOccurrence,

  completed: {
    id: 'occ-completed-456',
    taskId: testTaskDefinitions.weeklyTask.id,
    task: testTaskDefinitions.weeklyTask,
    dueDate: new Date('2024-01-29'),
    status: 'completed' as const,
    assigneeIds: [testUsers.member.id],
    completedAt: new Date('2024-01-29T10:00:00Z'),
    completedByUserId: testUsers.member.id,
    createdAt: new Date('2024-01-22'),
    updatedAt: new Date('2024-01-29'),
  } as TaskOccurrence,
}

export const testNotificationPreferences = {
  admin: {
    userId: testUsers.admin.id,
    task_created: 'any' as const,
    task_paused: 'any' as const,
    task_completed: 'any' as const,
    task_deleted: 'any' as const,
    occurrence_assigned: 'mine' as const,
    occurrence_executed: 'mine' as const,
    occurrence_skipped: 'mine' as const,
    occurrence_commented: 'mine' as const,
  },

  member: {
    userId: testUsers.member.id,
    task_created: 'none' as const,
    task_paused: 'none' as const,
    task_completed: 'none' as const,
    task_deleted: 'none' as const,
    occurrence_assigned: 'any' as const,
    occurrence_executed: 'any' as const,
    occurrence_skipped: 'any' as const,
    occurrence_commented: 'any' as const,
  }
}