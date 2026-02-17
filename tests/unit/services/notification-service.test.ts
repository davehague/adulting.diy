import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NotificationService } from '@/server/services/NotificationService'
import type { NotificationPreferences } from '@/types/notification'
import { defaultNotificationPreferences } from '@/types/notification'
import type { NotificationEventType, NotificationContext } from '@/server/services/NotificationService'

// Preferences using snake_case keys — this is what the DB actually stores
const allAnyPrefs: NotificationPreferences = {
  task_created: 'any',
  task_paused: 'any',
  task_completed: 'any',
  task_deleted: 'any',
  occurrence_assigned: 'any',
  occurrence_executed: 'any',
  occurrence_skipped: 'any',
  occurrence_commented: 'any',
}

const allNonePrefs: NotificationPreferences = {
  task_created: 'none',
  task_paused: 'none',
  task_completed: 'none',
  task_deleted: 'none',
  occurrence_assigned: 'none',
  occurrence_executed: 'none',
  occurrence_skipped: 'none',
  occurrence_commented: 'none',
}

const minePrefs: NotificationPreferences = {
  task_created: 'none',
  task_paused: 'none',
  task_completed: 'none',
  task_deleted: 'none',
  occurrence_assigned: 'mine',
  occurrence_executed: 'mine',
  occurrence_skipped: 'mine',
  occurrence_commented: 'mine',
}

const userId = 'user-1'
const otherUserId = 'user-2'

const baseContext: NotificationContext = {
  user: { id: userId, email: 'test@test.com', name: 'Test' } as any,
}

const contextWithOccurrenceAssignedToUser: NotificationContext = {
  ...baseContext,
  occurrence: { assigneeIds: [userId] } as any,
}

const contextWithOccurrenceAssignedToOther: NotificationContext = {
  ...baseContext,
  occurrence: { assigneeIds: [otherUserId] } as any,
}

describe('NotificationService.shouldSendNotification', () => {
  const service = new NotificationService()

  // --- "none" preference blocks all notifications ---
  describe('when preference is "none"', () => {
    it.each([
      'task_created', 'task_paused', 'task_completed', 'task_deleted',
      'occurrence_assigned', 'occurrence_executed', 'occurrence_skipped', 'occurrence_commented',
    ] as NotificationEventType[])('blocks %s notification', (eventType) => {
      expect(service.shouldSendNotification(eventType, allNonePrefs, baseContext, userId)).toBe(false)
    })
  })

  // --- "any" preference sends to non-actors ---
  describe('when preference is "any"', () => {
    it.each([
      'task_created', 'task_paused', 'task_completed', 'task_deleted',
    ] as NotificationEventType[])('sends %s notification', (eventType) => {
      expect(service.shouldSendNotification(eventType, allAnyPrefs, baseContext, userId)).toBe(true)
    })

    it.each([
      'occurrence_assigned', 'occurrence_executed', 'occurrence_skipped', 'occurrence_commented',
    ] as NotificationEventType[])('sends %s notification', (eventType) => {
      expect(service.shouldSendNotification(eventType, allAnyPrefs, contextWithOccurrenceAssignedToUser, userId)).toBe(true)
    })
  })

  // --- task_created does not notify the action performer ---
  describe('task_created excludes action performer', () => {
    it('does NOT send task_created to the user who created the task', () => {
      const contextWithSelfAsActor: NotificationContext = {
        ...baseContext,
        actionUser: { id: userId } as any,
      }
      expect(service.shouldSendNotification('task_created', allAnyPrefs, contextWithSelfAsActor, userId)).toBe(false)
    })

    it('sends task_created to other users when actionUser differs', () => {
      const contextWithOtherActor: NotificationContext = {
        ...baseContext,
        actionUser: { id: otherUserId } as any,
      }
      expect(service.shouldSendNotification('task_created', allAnyPrefs, contextWithOtherActor, userId)).toBe(true)
    })
  })

  // --- "mine" occurrence preference sends only to assignees ---
  describe('when occurrence preference is "mine"', () => {
    it('sends when user is assignee', () => {
      expect(service.shouldSendNotification('occurrence_assigned', minePrefs, contextWithOccurrenceAssignedToUser, userId)).toBe(true)
    })

    it('does NOT send when user is not assignee', () => {
      expect(service.shouldSendNotification('occurrence_assigned', minePrefs, contextWithOccurrenceAssignedToOther, userId)).toBe(false)
    })
  })

  // --- Reminders always send ---
  describe('reminder notifications', () => {
    it.each([
      'task_reminder_initial', 'task_reminder_followup', 'task_reminder_overdue',
    ] as NotificationEventType[])('always sends %s regardless of preferences', (eventType) => {
      expect(service.shouldSendNotification(eventType, allNonePrefs, baseContext, userId)).toBe(true)
    })
  })

  // --- Default preferences are snake_case and correct ---
  describe('getDefaultPreferences', () => {
    it('returns snake_case keys matching the NotificationPreferences type', () => {
      const defaults = service.getDefaultPreferences()
      expect(defaults).toHaveProperty('task_created')
      expect(defaults).toHaveProperty('occurrence_assigned')
      // Should NOT have camelCase keys
      expect(defaults).not.toHaveProperty('taskCreated')
      expect(defaults).not.toHaveProperty('occurrenceAssigned')
    })

    it('returns values matching defaultNotificationPreferences from types/notification.ts', () => {
      const defaults = service.getDefaultPreferences()
      expect(defaults).toEqual(defaultNotificationPreferences)
    })

    it('returns a new object each time (not a shared reference)', () => {
      const a = service.getDefaultPreferences()
      const b = service.getDefaultPreferences()
      expect(a).toEqual(b)
      expect(a).not.toBe(b)
    })
  })
})

describe('isDateToday', () => {
  const service = new NotificationService()

  it('returns true when date matches today', () => {
    const today = new Date()
    expect(service.isDateToday(today)).toBe(true)
  })

  it('returns false for yesterday', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(service.isDateToday(yesterday)).toBe(false)
  })

  it('returns false for tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(service.isDateToday(tomorrow)).toBe(false)
  })
})

describe('checkAndSendTaskReminders', () => {
  it('returns 0 when task has no reminderConfig', async () => {
    const service = new NotificationService()
    const task = { id: 'task-1', reminderConfig: null } as any
    const count = await service.checkAndSendTaskReminders(task)
    expect(count).toBe(0)
  })

  it('sends overdue reminder for occurrence with dueDate in the past', async () => {
    const service = new NotificationService()
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    threeDaysAgo.setHours(0, 0, 0, 0)

    const task = {
      id: 'task-1',
      householdId: 'household-1',
      metaStatus: 'active',
      reminderConfig: { overdueReminder: 3 },
    }

    // Mock prisma to return the overdue occurrence
    const { default: prisma } = await import('@/server/utils/prisma/client')
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValueOnce([
      {
        id: 'occ-1',
        taskId: 'task-1',
        dueDate: threeDaysAgo,
        status: 'assigned',
        assigneeIds: ['user-1'],
        createdAt: threeDaysAgo,
        updatedAt: threeDaysAgo,
      },
    ] as any)

    // Mock sendNotification to track calls
    const sendSpy = vi.spyOn(service, 'sendNotification').mockResolvedValue()

    const count = await service.checkAndSendTaskReminders(task as any)

    expect(count).toBe(1)
    expect(sendSpy).toHaveBeenCalledWith(
      'household-1',
      'task_reminder_overdue',
      expect.any(Object)
    )

    sendSpy.mockRestore()
  })
})
