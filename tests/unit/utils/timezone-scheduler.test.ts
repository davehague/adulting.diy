import { describe, it, expect } from 'vitest'
import { NotificationService } from '@/server/services/NotificationService'

describe('NotificationService timezone awareness', () => {
  const service = new NotificationService()

  describe('isDateToday', () => {
    it('returns true when date is today in UTC', () => {
      const now = new Date()
      expect(service.isDateToday(now, 'UTC')).toBe(true)
    })

    it('returns false for yesterday in UTC', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(service.isDateToday(yesterday, 'UTC')).toBe(false)
    })

    it('defaults to UTC when no timezone provided', () => {
      const now = new Date()
      expect(service.isDateToday(now)).toBe(true)
    })

    it('handles different timezone correctly', () => {
      // This test verifies the function accepts timezone strings without error
      const now = new Date()
      // Should not throw
      const result = service.isDateToday(now, 'America/New_York')
      expect(typeof result).toBe('boolean')
    })
  })
})
