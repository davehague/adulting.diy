import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NotificationService } from '@/server/services/NotificationService'
import { EmailProvider } from '@/server/services/notifications/EmailProvider'
import type { NotificationPreferences } from '@/types/notification'
import { defaultNotificationPreferences } from '@/types/notification'
import type { NotificationEventType, NotificationContext } from '@/server/services/NotificationService'

// Preferences using snake_case keys — this is what the DB actually stores
const allAnyPrefs: NotificationPreferences = {
  task_created: 'any',
  task_paused: 'any',
  task_deleted: 'any',
  occurrence_assigned: 'any',
  occurrence_executed: 'any',
  occurrence_skipped: 'any',
  occurrence_commented: 'any',
  reminders: 'any',
}

const allNonePrefs: NotificationPreferences = {
  task_created: 'none',
  task_paused: 'none',
  task_deleted: 'none',
  occurrence_assigned: 'none',
  occurrence_executed: 'none',
  occurrence_skipped: 'none',
  occurrence_commented: 'none',
  reminders: 'none',
}

const minePrefs: NotificationPreferences = {
  task_created: 'none',
  task_paused: 'none',
  task_deleted: 'none',
  occurrence_assigned: 'mine',
  occurrence_executed: 'mine',
  occurrence_skipped: 'mine',
  occurrence_commented: 'mine',
  reminders: 'any',
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
      'task_created', 'task_paused', 'task_deleted',
      'occurrence_assigned', 'occurrence_executed', 'occurrence_skipped', 'occurrence_commented',
    ] as NotificationEventType[])('blocks %s notification', (eventType) => {
      expect(service.shouldSendNotification(eventType, allNonePrefs, baseContext, userId)).toBe(false)
    })
  })

  // --- "any" preference sends to non-actors ---
  describe('when preference is "any"', () => {
    it.each([
      'task_created', 'task_paused', 'task_deleted',
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

  // --- Reminders respect single reminders preference ---
  describe('task_reminder notifications', () => {
    it('sends when preference is "any"', () => {
      const prefs: NotificationPreferences = { ...allNonePrefs, reminders: 'any' }
      expect(service.shouldSendNotification('task_reminder', prefs, baseContext, userId)).toBe(true)
    })

    it('blocks when preference is "none"', () => {
      const prefs: NotificationPreferences = { ...allAnyPrefs, reminders: 'none' }
      expect(service.shouldSendNotification('task_reminder', prefs, baseContext, userId)).toBe(false)
    })

    it('sends when preference is "mine" and user is assignee', () => {
      const prefs: NotificationPreferences = { ...allNonePrefs, reminders: 'mine' }
      expect(service.shouldSendNotification(
        'task_reminder', prefs, contextWithOccurrenceAssignedToUser, userId
      )).toBe(true)
    })

    it('does NOT send when preference is "mine" and user is not assignee', () => {
      const prefs: NotificationPreferences = { ...allNonePrefs, reminders: 'mine' }
      expect(service.shouldSendNotification(
        'task_reminder', prefs, contextWithOccurrenceAssignedToOther, userId
      )).toBe(false)
    })

    it('defaults to sending when reminders preference is missing (backward compat)', () => {
      const legacyPrefs = { ...allAnyPrefs } as any
      delete legacyPrefs.reminders
      expect(service.shouldSendNotification('task_reminder', legacyPrefs, baseContext, userId)).toBe(true)
    })
  })

  // --- Default preferences are correct ---
  describe('getDefaultPreferences', () => {
    it('returns keys matching the NotificationPreferences type', () => {
      const defaults = service.getDefaultPreferences()
      expect(defaults).toHaveProperty('task_created')
      expect(defaults).toHaveProperty('occurrence_assigned')
      expect(defaults).toHaveProperty('reminders')
      // Should NOT have old keys
      expect(defaults).not.toHaveProperty('reminder_initial')
      expect(defaults).not.toHaveProperty('reminder_followup')
      expect(defaults).not.toHaveProperty('reminder_overdue')
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

  it('returns 0 when reminderConfig has empty reminders array', async () => {
    const service = new NotificationService()
    const task = { id: 'task-1', reminderConfig: { reminders: [] } } as any
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
      createdByUserId: 'user-1',
      metaStatus: 'active',
      reminderConfig: { reminders: [{ days: 3, timing: 'after' }] },
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

    // No prior reminder sent today
    vi.mocked(prisma.occurrenceHistoryLog.findFirst).mockResolvedValueOnce(null)
    // Mock the log creation for dedup tracking
    vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValueOnce({} as any)

    // Mock sendNotification to track calls (returns true = sent successfully)
    const sendSpy = vi.spyOn(service, 'sendNotification').mockResolvedValue(true)

    const count = await service.checkAndSendTaskReminders(task as any)

    expect(count).toBe(1)
    expect(sendSpy).toHaveBeenCalledWith(
      'household-1',
      'task_reminder',
      expect.objectContaining({
        reminderEntry: { days: 3, timing: 'after' },
      })
    )

    sendSpy.mockRestore()
  })

  it('sends before reminder for upcoming occurrence', async () => {
    const service = new NotificationService()
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
    threeDaysFromNow.setHours(0, 0, 0, 0)

    const task = {
      id: 'task-1',
      householdId: 'household-1',
      createdByUserId: 'user-1',
      metaStatus: 'active',
      reminderConfig: { reminders: [{ days: 3, timing: 'before' }] },
    }

    const { default: prisma } = await import('@/server/utils/prisma/client')
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValueOnce([
      {
        id: 'occ-1',
        taskId: 'task-1',
        dueDate: threeDaysFromNow,
        status: 'assigned',
        assigneeIds: ['user-1'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any)

    vi.mocked(prisma.occurrenceHistoryLog.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValueOnce({} as any)

    const sendSpy = vi.spyOn(service, 'sendNotification').mockResolvedValue(true)

    const count = await service.checkAndSendTaskReminders(task as any)

    expect(count).toBe(1)
    expect(sendSpy).toHaveBeenCalledWith(
      'household-1',
      'task_reminder',
      expect.objectContaining({
        reminderEntry: { days: 3, timing: 'before' },
      })
    )

    sendSpy.mockRestore()
  })

  it('processes multiple reminders in config', async () => {
    const service = new NotificationService()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Due in 3 days - should match the "3 days before" reminder
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
    threeDaysFromNow.setHours(0, 0, 0, 0)

    const task = {
      id: 'task-1',
      householdId: 'household-1',
      createdByUserId: 'user-1',
      metaStatus: 'active',
      reminderConfig: {
        reminders: [
          { days: 3, timing: 'before' },
          { days: 1, timing: 'before' },
          { days: 2, timing: 'after' },
        ],
      },
    }

    const { default: prisma } = await import('@/server/utils/prisma/client')
    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValueOnce([
      {
        id: 'occ-1',
        taskId: 'task-1',
        dueDate: threeDaysFromNow,
        status: 'assigned',
        assigneeIds: ['user-1'],
        createdAt: today,
        updatedAt: today,
      },
    ] as any)

    // First reminder (3 days before) - no prior sent, should send
    vi.mocked(prisma.occurrenceHistoryLog.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValueOnce({} as any)
    // Second reminder (1 day before) - not today, won't be checked
    // Third reminder (2 days after) - not today, won't be checked

    const sendSpy = vi.spyOn(service, 'sendNotification').mockResolvedValue(true)

    const count = await service.checkAndSendTaskReminders(task as any)

    // Only the "3 days before" reminder should fire today
    expect(count).toBe(1)

    sendSpy.mockRestore()
  })
})

describe('renderEmailTemplate', () => {
  const provider = new EmailProvider()

  it('task_created renders with description', () => {
    const html = provider.renderEmailTemplate('task_created', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      descriptionBlock: '<p><strong>Description:</strong> Wipe counters</p>',
      categoryName: 'Cleaning',
      createdByName: 'Bob',
      taskUrl: 'http://localhost/tasks/1',
    })
    expect(html).toContain('Alice')
    expect(html).toContain('Clean Kitchen')
    expect(html).toContain('Wipe counters')
    expect(html).toContain('Cleaning')
    expect(html).toContain('Bob')
    expect(html).not.toContain('{{')
  })

  it('task_created renders without description (empty descriptionBlock)', () => {
    const html = provider.renderEmailTemplate('task_created', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      descriptionBlock: '',
      categoryName: 'Cleaning',
      createdByName: 'Bob',
      taskUrl: 'http://localhost/tasks/1',
    })
    expect(html).toContain('Alice')
    expect(html).not.toContain('Description:')
    expect(html).not.toContain('{{')
  })

  it('task_reminder uses amber colors for before timing', () => {
    const html = provider.renderEmailTemplate('task_reminder', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      dueDate: 'January 20, 2025',
      heading: 'Task Reminder',
      headingColor: '#d97706',
      bgColor: '#fffbeb',
      buttonColor: '#d97706',
      dueSummary: 'Your task is due in 3 days:',
      occurrenceUrl: 'http://localhost/occurrences/1',
    })
    expect(html).toContain('#d97706')
    expect(html).toContain('Task Reminder')
    expect(html).toContain('due in 3 days')
    expect(html).not.toContain('{{')
  })

  it('task_reminder uses amber colors for on-day timing', () => {
    const html = provider.renderEmailTemplate('task_reminder', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      dueDate: 'January 20, 2025',
      heading: 'Due Today',
      headingColor: '#d97706',
      bgColor: '#fffbeb',
      buttonColor: '#d97706',
      dueSummary: 'Your task is due today:',
      occurrenceUrl: 'http://localhost/occurrences/1',
    })
    expect(html).toContain('#d97706')
    expect(html).toContain('Due Today')
    expect(html).toContain('due today')
    expect(html).not.toContain('{{')
  })

  it('task_reminder uses red colors for after timing (overdue)', () => {
    const html = provider.renderEmailTemplate('task_reminder', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      dueDate: 'January 15, 2025',
      heading: 'Task Overdue',
      headingColor: '#dc2626',
      bgColor: '#fef2f2',
      buttonColor: '#dc2626',
      dueSummary: 'Your task is 5 days overdue:',
      occurrenceUrl: 'http://localhost/occurrences/1',
    })
    expect(html).toContain('#dc2626')
    expect(html).toContain('Task Overdue')
    expect(html).toContain('5 days overdue')
    expect(html).not.toContain('{{')
  })

  it('task_paused renders with warning styling', () => {
    const html = provider.renderEmailTemplate('task_paused', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      pausedByName: 'Bob',
      taskUrl: 'http://localhost/tasks/1',
    })
    expect(html).toContain('Alice')
    expect(html).toContain('Clean Kitchen')
    expect(html).toContain('Task Paused')
    expect(html).toContain('Bob')
    expect(html).not.toContain('{{')
  })

  it('task_deleted renders with red styling', () => {
    const html = provider.renderEmailTemplate('task_deleted', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      deletedByName: 'Bob',
    })
    expect(html).toContain('Alice')
    expect(html).toContain('Clean Kitchen')
    expect(html).toContain('Task Deleted')
    expect(html).toContain('Bob')
    expect(html).not.toContain('{{')
  })

  it('occurrence_executed renders with green styling', () => {
    const html = provider.renderEmailTemplate('occurrence_executed', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      completedByName: 'Bob',
      dueDate: 'January 20, 2025',
      occurrenceUrl: 'http://localhost/occurrences/1',
    })
    expect(html).toContain('Alice')
    expect(html).toContain('Clean Kitchen')
    expect(html).toContain('Task Completed')
    expect(html).toContain('Bob')
    expect(html).not.toContain('{{')
  })

  it('occurrence_skipped renders with amber styling', () => {
    const html = provider.renderEmailTemplate('occurrence_skipped', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      skippedByName: 'Bob',
      dueDate: 'January 20, 2025',
      occurrenceUrl: 'http://localhost/occurrences/1',
    })
    expect(html).toContain('Alice')
    expect(html).toContain('Clean Kitchen')
    expect(html).toContain('Task Skipped')
    expect(html).toContain('Bob')
    expect(html).not.toContain('{{')
  })

  it('occurrence_commented renders with comment content', () => {
    const html = provider.renderEmailTemplate('occurrence_commented', {
      userName: 'Alice',
      taskName: 'Clean Kitchen',
      commentedByName: 'Bob',
      comment: 'Need to buy supplies first',
      occurrenceUrl: 'http://localhost/occurrences/1',
    })
    expect(html).toContain('Alice')
    expect(html).toContain('Clean Kitchen')
    expect(html).toContain('New Comment')
    expect(html).toContain('Bob')
    expect(html).toContain('Need to buy supplies first')
    expect(html).not.toContain('{{')
  })

  it('unknown template falls back to generic', () => {
    const html = provider.renderEmailTemplate('unknown_template', {
      userName: 'Alice',
      taskName: 'Test',
      eventType: 'some_event',
    })
    expect(html).toContain('Adulting.DIY Notification')
    expect(html).toContain('Alice')
  })
})

describe('generateEmailContent', () => {
  const provider = new EmailProvider()
  const baseContext = {
    user: { id: 'u1', name: 'Alice', email: 'alice@test.com' } as any,
    task: { id: 't1', name: 'Clean Kitchen', description: 'Wipe counters', category: { name: 'Cleaning' } } as any,
    occurrence: { id: 'o1', dueDate: new Date('2025-03-01'), assigneeIds: ['u1'] } as any,
    actionUser: { id: 'u2', name: 'Bob' } as any,
    household: { id: 'h1', name: 'Test House' },
  }

  it('task_reminder with before timing returns proper subject and body', () => {
    const ctx = { ...baseContext, reminderEntry: { days: 3, timing: 'before' as const } }
    const result = provider.generateEmailContent('task_reminder', ctx, baseContext.user)
    expect(result.subject).toContain('Reminder')
    expect(result.subject).toContain('Clean Kitchen')
    expect(result.body).toContain('Task Reminder')
    expect(result.body).toContain('#d97706')
    expect(result.body).not.toContain('Adulting.DIY Notification')
  })

  it('task_reminder with before timing=1 shows "due tomorrow"', () => {
    const ctx = { ...baseContext, reminderEntry: { days: 1, timing: 'before' as const } }
    const result = provider.generateEmailContent('task_reminder', ctx, baseContext.user)
    expect(result.subject).toContain('due tomorrow')
    expect(result.body).toContain('due tomorrow')
  })

  it('task_reminder with on timing returns "Due Today" subject', () => {
    const ctx = { ...baseContext, reminderEntry: { days: 0, timing: 'on' as const } }
    const result = provider.generateEmailContent('task_reminder', ctx, baseContext.user)
    expect(result.subject).toContain('Due Today')
    expect(result.body).toContain('Due Today')
    expect(result.body).toContain('#d97706')
  })

  it('task_reminder with after timing returns "Overdue" subject with red', () => {
    const ctx = { ...baseContext, reminderEntry: { days: 5, timing: 'after' as const } }
    const result = provider.generateEmailContent('task_reminder', ctx, baseContext.user)
    expect(result.subject).toContain('Overdue')
    expect(result.subject).toContain('5 days overdue')
    expect(result.body).toContain('Task Overdue')
    expect(result.body).toContain('#dc2626')
  })

  it('task_created includes description when present', () => {
    const result = provider.generateEmailContent('task_created', baseContext, baseContext.user)
    expect(result.body).toContain('Wipe counters')
  })

  it('task_created omits description when not present', () => {
    const noDescContext = {
      ...baseContext,
      task: { ...baseContext.task, description: undefined },
    }
    const result = provider.generateEmailContent('task_created', noDescContext, baseContext.user)
    expect(result.body).not.toContain('Description:')
  })

  it('task_paused returns proper subject and body', () => {
    const result = provider.generateEmailContent('task_paused', baseContext, baseContext.user)
    expect(result.subject).toContain('Task Paused')
    expect(result.subject).toContain('Clean Kitchen')
    expect(result.body).toContain('Task Paused')
    expect(result.body).not.toContain('Adulting.DIY Notification')
  })

  it('task_deleted returns proper subject and body', () => {
    const result = provider.generateEmailContent('task_deleted', baseContext, baseContext.user)
    expect(result.subject).toContain('Task Deleted')
    expect(result.body).toContain('Task Deleted')
    expect(result.body).not.toContain('Adulting.DIY Notification')
  })

  it('occurrence_executed returns proper subject and body', () => {
    const result = provider.generateEmailContent('occurrence_executed', baseContext, baseContext.user)
    expect(result.subject).toContain('Task Completed')
    expect(result.body).toContain('Task Completed')
    expect(result.body).not.toContain('Adulting.DIY Notification')
  })

  it('occurrence_skipped returns proper subject and body', () => {
    const result = provider.generateEmailContent('occurrence_skipped', baseContext, baseContext.user)
    expect(result.subject).toContain('Task Skipped')
    expect(result.body).toContain('Task Skipped')
    expect(result.body).not.toContain('Adulting.DIY Notification')
  })

  it('occurrence_commented returns proper subject with comment content', () => {
    const commentContext = { ...baseContext, comment: 'Test comment' }
    const result = provider.generateEmailContent('occurrence_commented', commentContext, baseContext.user)
    expect(result.subject).toContain('New Comment')
    expect(result.body).toContain('New Comment')
    expect(result.body).toContain('Test comment')
    expect(result.body).not.toContain('Adulting.DIY Notification')
  })
})

describe('isUserRelatedToOccurrence with comment history', () => {
  const service = new NotificationService()

  it('returns true when user is an assignee', () => {
    const context: NotificationContext = {
      user: { id: 'u1' } as any,
      occurrence: { assigneeIds: ['u1'] } as any,
    }
    expect(service.isUserRelatedToOccurrence('u1', context)).toBe(true)
  })

  it('returns true when user has commented (via commentUserIds)', () => {
    const context: NotificationContext = {
      user: { id: 'u1' } as any,
      occurrence: { assigneeIds: ['u2'], commentUserIds: ['u1'] } as any,
    }
    expect(service.isUserRelatedToOccurrence('u1', context)).toBe(true)
  })

  it('returns false when user is neither assignee nor commenter', () => {
    const context: NotificationContext = {
      user: { id: 'u3' } as any,
      occurrence: { assigneeIds: ['u1'], commentUserIds: ['u2'] } as any,
    }
    expect(service.isUserRelatedToOccurrence('u3', context)).toBe(false)
  })

  it('returns false when no occurrence in context', () => {
    const context: NotificationContext = {
      user: { id: 'u1' } as any,
    }
    expect(service.isUserRelatedToOccurrence('u1', context)).toBe(false)
  })

  it('returns false when commentUserIds is not present', () => {
    const context: NotificationContext = {
      user: { id: 'u1' } as any,
      occurrence: { assigneeIds: ['u2'] } as any,
    }
    expect(service.isUserRelatedToOccurrence('u1', context)).toBe(false)
  })
})

describe('duplicate reminder prevention', () => {
  it('does not send reminder if one was already sent today', async () => {
    const service = new NotificationService()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 3)
    dueDate.setHours(0, 0, 0, 0)

    const task = {
      id: 'task-1',
      householdId: 'household-1',
      createdByUserId: 'user-1',
      reminderConfig: { reminders: [{ days: 3, timing: 'before' }] },
    }

    const { default: prisma } = await import('@/server/utils/prisma/client')

    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValueOnce([
      {
        id: 'occ-1',
        taskId: 'task-1',
        dueDate: dueDate,
        status: 'assigned',
        assigneeIds: ['user-1'],
        createdAt: today,
        updatedAt: today,
      },
    ] as any)

    // Simulate that a reminder was already sent today with new dedup key
    vi.mocked(prisma.occurrenceHistoryLog.findFirst).mockResolvedValueOnce({
      id: 'log-1',
      occurrenceId: 'occ-1',
      userId: 'user-1',
      logType: 'reminder_sent',
      newValue: 'task_reminder:before:3',
      createdAt: new Date(),
    } as any)

    const sendSpy = vi.spyOn(service, 'sendNotification').mockResolvedValue(true)
    const count = await service.checkAndSendTaskReminders(task as any)

    expect(count).toBe(0)
    expect(sendSpy).not.toHaveBeenCalled()

    sendSpy.mockRestore()
  })

  it('sends reminder if none was sent today', async () => {
    const service = new NotificationService()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 3)
    dueDate.setHours(0, 0, 0, 0)

    const task = {
      id: 'task-1',
      householdId: 'household-1',
      createdByUserId: 'user-1',
      reminderConfig: { reminders: [{ days: 3, timing: 'before' }] },
    }

    const { default: prisma } = await import('@/server/utils/prisma/client')

    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValueOnce([
      {
        id: 'occ-1',
        taskId: 'task-1',
        dueDate: dueDate,
        status: 'assigned',
        assigneeIds: ['user-1'],
        createdAt: today,
        updatedAt: today,
      },
    ] as any)

    // No prior reminder sent
    vi.mocked(prisma.occurrenceHistoryLog.findFirst).mockResolvedValueOnce(null)

    const sendSpy = vi.spyOn(service, 'sendNotification').mockResolvedValue(true)
    // Mock the log creation
    vi.mocked(prisma.occurrenceHistoryLog.create).mockResolvedValueOnce({} as any)

    const count = await service.checkAndSendTaskReminders(task as any)

    expect(count).toBe(1)
    expect(sendSpy).toHaveBeenCalledWith(
      'household-1',
      'task_reminder',
      expect.objectContaining({
        reminderEntry: { days: 3, timing: 'before' },
      })
    )

    sendSpy.mockRestore()
  })

  it('does not log dedup record when send fails', async () => {
    const service = new NotificationService()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 3)
    dueDate.setHours(0, 0, 0, 0)

    const task = {
      id: 'task-1',
      householdId: 'household-1',
      createdByUserId: 'user-1',
      reminderConfig: { reminders: [{ days: 3, timing: 'before' }] },
    }

    const { default: prisma } = await import('@/server/utils/prisma/client')

    // Clear any residual calls from prior tests
    vi.mocked(prisma.occurrenceHistoryLog.create).mockClear()

    vi.mocked(prisma.taskOccurrence.findMany).mockResolvedValueOnce([
      {
        id: 'occ-1',
        taskId: 'task-1',
        dueDate: dueDate,
        status: 'assigned',
        assigneeIds: ['user-1'],
        createdAt: today,
        updatedAt: today,
      },
    ] as any)

    // No prior reminder sent
    vi.mocked(prisma.occurrenceHistoryLog.findFirst).mockResolvedValueOnce(null)

    // sendNotification returns false (all providers failed)
    const sendSpy = vi.spyOn(service, 'sendNotification').mockResolvedValue(false)

    const count = await service.checkAndSendTaskReminders(task as any)

    expect(count).toBe(0)
    expect(sendSpy).toHaveBeenCalled()
    // Dedup log should NOT have been created
    expect(prisma.occurrenceHistoryLog.create).not.toHaveBeenCalled()

    sendSpy.mockRestore()
  })
})

describe('Notification preferences vs reminder config interaction', () => {
  const service = new NotificationService()

  it('event notification respects "none" preference', () => {
    const prefs: NotificationPreferences = {
      ...allAnyPrefs,
      occurrence_executed: 'none',
    }
    const result = service.shouldSendNotification(
      'occurrence_executed', prefs, contextWithOccurrenceAssignedToUser, userId
    )
    expect(result).toBe(false)
  })

  it('task_reminder respects "none" reminders preference', () => {
    const prefsWithRemindersOff: NotificationPreferences = {
      ...allAnyPrefs,
      reminders: 'none',
    }
    expect(service.shouldSendNotification(
      'task_reminder', prefsWithRemindersOff, baseContext, userId
    )).toBe(false)
  })

  it('"mine" occurrence preference sends only when user is assignee', () => {
    const prefs: NotificationPreferences = {
      ...allNonePrefs,
      occurrence_executed: 'mine',
    }
    expect(service.shouldSendNotification(
      'occurrence_executed', prefs, contextWithOccurrenceAssignedToUser, userId
    )).toBe(true)
    expect(service.shouldSendNotification(
      'occurrence_executed', prefs, contextWithOccurrenceAssignedToOther, userId
    )).toBe(false)
  })
})
