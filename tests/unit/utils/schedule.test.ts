import { describe, it, expect } from 'vitest'
import { addDays, addWeeks, addMonths, startOfDay } from 'date-fns'
import type { TaskDefinition } from '@/types'

// Test the core scheduling logic
describe('Schedule Logic Tests', () => {
  
  describe('Date calculations', () => {
    it('should correctly add days to a date', () => {
      const startDate = new Date('2024-01-01')
      const result = addDays(startDate, 7)
      expect(result).toEqual(new Date('2024-01-08'))
    })

    it('should correctly add weeks to a date', () => {
      const startDate = new Date('2024-01-01')
      const result = addWeeks(startDate, 2)
      expect(result).toEqual(new Date('2024-01-15'))
    })

    it('should correctly add months to a date', () => {
      const startDate = new Date('2024-01-01')
      const result = addMonths(startDate, 1)
      expect(result).toEqual(new Date('2024-02-01'))
    })
  })

  describe('Recurrence pattern logic', () => {
    it('should generate correct dates for weekly interval', () => {
      const startDate = new Date('2024-01-01') // Monday
      const endDate = new Date('2024-01-29')   // 4 weeks later
      const dates: Date[] = []
      
      let currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        dates.push(new Date(currentDate))
        currentDate = addWeeks(currentDate, 1)
      }

      expect(dates).toHaveLength(5) // Start date + 4 weeks
      expect(dates[0]).toEqual(new Date('2024-01-01'))
      expect(dates[1]).toEqual(new Date('2024-01-08'))
      expect(dates[4]).toEqual(new Date('2024-01-29'))
    })

    it('should respect end condition - after N times', () => {
      const startDate = new Date('2024-01-01')
      const maxOccurrences = 3
      const dates: Date[] = []
      
      let currentDate = new Date(startDate)
      let count = 0
      
      while (count < maxOccurrences) {
        dates.push(new Date(currentDate))
        currentDate = addWeeks(currentDate, 1)
        count++
      }

      expect(dates).toHaveLength(3)
      expect(dates[0]).toEqual(new Date('2024-01-01'))
      expect(dates[2]).toEqual(new Date('2024-01-15'))
    })

    it('should respect end condition - until date', () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-15')
      const dates: Date[] = []
      
      let currentDate = new Date(startDate)
      
      while (currentDate <= endDate) {
        dates.push(new Date(currentDate))
        currentDate = addWeeks(currentDate, 1)
      }

      expect(dates).toHaveLength(3) // Jan 1, 8, 15
      expect(dates[dates.length - 1].getTime()).toBeLessThanOrEqual(endDate.getTime())
    })

    it('should identify specific days of week correctly', () => {
      // Use UTC to avoid timezone issues
      const testDates = [
        { date: new Date('2024-01-01T00:00:00Z'), day: 1 }, // Monday
        { date: new Date('2024-01-02T00:00:00Z'), day: 2 }, // Tuesday  
        { date: new Date('2024-01-03T00:00:00Z'), day: 3 }, // Wednesday
        { date: new Date('2024-01-04T00:00:00Z'), day: 4 }, // Thursday
        { date: new Date('2024-01-05T00:00:00Z'), day: 5 }, // Friday
        { date: new Date('2024-01-06T00:00:00Z'), day: 6 }, // Saturday
        { date: new Date('2024-01-07T00:00:00Z'), day: 0 }, // Sunday
      ]

      testDates.forEach(({ date, day }) => {
        expect(date.getUTCDay()).toBe(day)
      })
    })

    it('should generate dates for specific days of week', () => {
      const startDate = new Date('2024-01-01') // Monday
      const endDate = new Date('2024-01-14')   // Two weeks later
      const targetDays = [1, 3, 5] // Monday, Wednesday, Friday
      const dates: Date[] = []
      
      let currentDate = new Date(startDate)
      
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay()
        if (targetDays.includes(dayOfWeek)) {
          dates.push(new Date(currentDate))
        }
        currentDate = addDays(currentDate, 1)
      }

      // Should get: Jan 1(Mon), 3(Wed), 5(Fri), 8(Mon), 10(Wed), 12(Fri)
      expect(dates).toHaveLength(6)
      
      // Check all dates are correct days of week
      dates.forEach(date => {
        const dayOfWeek = date.getDay()
        expect(targetDays).toContain(dayOfWeek)
      })
    })
  })

  describe('Notification timing logic', () => {
    it('should calculate correct reminder dates', () => {
      const dueDate = new Date('2024-01-15')
      const initialReminderDays = 2
      const followUpReminderDays = 1
      const overdueReminderDays = 1

      const initialReminderDate = addDays(dueDate, -initialReminderDays)
      const followUpReminderDate = addDays(dueDate, -followUpReminderDays)
      const overdueReminderDate = addDays(dueDate, overdueReminderDays)

      expect(initialReminderDate).toEqual(new Date('2024-01-13'))
      expect(followUpReminderDate).toEqual(new Date('2024-01-14'))
      expect(overdueReminderDate).toEqual(new Date('2024-01-16'))
    })

    it('should handle same-day reminders', () => {
      const dueDate = new Date('2024-01-15')
      const sameDayReminder = 0

      const reminderDate = addDays(dueDate, -sameDayReminder)
      expect(reminderDate).toEqual(dueDate)
    })
  })

  describe('Variable interval logic', () => {
    it('should calculate next occurrence from completion date', () => {
      const completionDate = new Date('2024-01-15T14:30:00Z')
      const intervalDays = 7
      
      // For variable interval, next occurrence is based on completion date
      // Use date-only calculation to avoid timezone issues
      const completionDateOnly = new Date(completionDate.getFullYear(), completionDate.getMonth(), completionDate.getDate())
      const nextOccurrence = addDays(completionDateOnly, intervalDays)
      
      expect(nextOccurrence.getFullYear()).toBe(2024)
      expect(nextOccurrence.getMonth()).toBe(0) // January = 0
      expect(nextOccurrence.getDate()).toBe(22)
    })

    it('should handle different completion times on same day', () => {
      const morningCompletion = new Date('2024-01-15T08:00:00Z')
      const eveningCompletion = new Date('2024-01-15T20:00:00Z')
      const intervalDays = 3
      
      // Extract date components to avoid timezone issues
      const morningDateOnly = new Date(morningCompletion.getFullYear(), morningCompletion.getMonth(), morningCompletion.getDate())
      const eveningDateOnly = new Date(eveningCompletion.getFullYear(), eveningCompletion.getMonth(), eveningCompletion.getDate())
      
      const nextFromMorning = addDays(morningDateOnly, intervalDays)
      const nextFromEvening = addDays(eveningDateOnly, intervalDays)
      
      // Both should result in the same next occurrence date
      expect(nextFromMorning.getTime()).toEqual(nextFromEvening.getTime())
      expect(nextFromMorning.getDate()).toBe(18)
    })
  })

  describe('Edge cases', () => {
    it('should handle month boundary correctly', () => {
      const endOfMonth = new Date('2024-01-31')
      const nextWeek = addWeeks(endOfMonth, 1)
      
      expect(nextWeek).toEqual(new Date('2024-02-07'))
    })

    it('should handle leap year correctly', () => {
      const feb28_2024 = new Date('2024-02-28') // 2024 is a leap year
      const nextDay = addDays(feb28_2024, 1)
      
      expect(nextDay).toEqual(new Date('2024-02-29')) // Should be Feb 29, not March 1
    })

    it('should handle year boundary correctly', () => {
      const endOfYear = new Date('2024-12-31')
      const nextWeek = addWeeks(endOfYear, 1)
      
      expect(nextWeek).toEqual(new Date('2025-01-07'))
    })
  })
})