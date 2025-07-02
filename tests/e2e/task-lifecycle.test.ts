import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setup, createPage, $fetch } from '@nuxt/test-utils/e2e'
import { testUsers, testCategories } from '@/tests/fixtures/test-data'

describe('Task Lifecycle E2E', async () => {
  await setup({
    server: true,
    browser: true,
  })

  let page: any
  
  beforeAll(async () => {
    page = await createPage()
    
    // Mock authentication by setting up session
    await page.goto('/')
    await page.evaluate(() => {
      // Mock Google OAuth login
      window.localStorage.setItem('auth-token', 'mock-admin-token')
    })
  })

  afterAll(async () => {
    await page?.close()
  })

  describe('Complete Task Management Workflow', () => {
    let createdTaskId: string
    let createdOccurrenceId: string

    it('should allow user to create a weekly recurring task', async () => {
      // Navigate to task creation page
      await page.goto('/tasks')
      await page.click('[data-testid="create-task-button"]')

      // Fill out task creation form
      await page.fill('[data-testid="task-name"]', 'Weekly House Cleaning')
      await page.fill('[data-testid="task-description"]', 'Clean the entire house every week')
      await page.fill('[data-testid="task-instructions"]', 'Vacuum, dust, and mop all rooms')
      
      // Select category
      await page.selectOption('[data-testid="task-category"]', testCategories.cleaning.id)
      
      // Set schedule to weekly
      await page.selectOption('[data-testid="schedule-type"]', 'fixed_interval')
      await page.fill('[data-testid="interval-value"]', '1')
      await page.selectOption('[data-testid="interval-unit"]', 'weeks')
      
      // Set start date
      const startDate = new Date()
      startDate.setDate(startDate.getDate() + 1) // Tomorrow
      await page.fill('[data-testid="start-date"]', startDate.toISOString().split('T')[0])
      
      // Set reminder configuration
      await page.fill('[data-testid="initial-reminder"]', '1')
      await page.fill('[data-testid="overdue-reminder"]', '1')
      
      // Assign to household member
      await page.check(`[data-testid="assignee-${testUsers.member.id}"]`)
      
      // Submit form
      await page.click('[data-testid="create-task-submit"]')
      
      // Wait for success message
      await page.waitForSelector('[data-testid="task-created-success"]')
      
      // Verify task appears in task list
      await page.goto('/tasks')
      const taskRow = page.locator('[data-testid="task-row"]').filter({ hasText: 'Weekly House Cleaning' })
      await expect(taskRow).toBeVisible()
      
      // Extract task ID for later use
      createdTaskId = await taskRow.getAttribute('data-task-id')
      expect(createdTaskId).toBeDefined()
    })

    it('should automatically generate first occurrence for the task', async () => {
      // Navigate to task detail page
      await page.goto(`/tasks/${createdTaskId}`)
      
      // Check that occurrences section shows at least one occurrence
      await page.waitForSelector('[data-testid="occurrences-section"]')
      const occurrenceCount = await page.locator('[data-testid="occurrence-row"]').count()
      expect(occurrenceCount).toBeGreaterThan(0)
      
      // Get the first occurrence
      const firstOccurrence = page.locator('[data-testid="occurrence-row"]').first()
      await expect(firstOccurrence).toBeVisible()
      
      // Verify occurrence has correct assignee
      await expect(firstOccurrence).toContainText(testUsers.member.name)
      
      // Extract occurrence ID
      createdOccurrenceId = await firstOccurrence.getAttribute('data-occurrence-id')
      expect(createdOccurrenceId).toBeDefined()
    })

    it('should allow user to complete an occurrence', async () => {
      // Navigate to occurrence detail page
      await page.goto(`/occurrences/${createdOccurrenceId}`)
      
      // Verify occurrence is in pending state
      await expect(page.locator('[data-testid="occurrence-status"]')).toContainText('Assigned')
      
      // Complete the occurrence
      await page.click('[data-testid="complete-occurrence-button"]')
      
      // Wait for completion to process
      await page.waitForSelector('[data-testid="occurrence-completed-success"]')
      
      // Verify status changed to completed
      await expect(page.locator('[data-testid="occurrence-status"]')).toContainText('Completed')
      
      // Verify completion appears in timeline
      const timeline = page.locator('[data-testid="occurrence-timeline"]')
      await expect(timeline).toContainText('completed')
      await expect(timeline).toContainText(testUsers.member.name)
    })

    it('should generate next occurrence after completion', async () => {
      // Go back to task detail page
      await page.goto(`/tasks/${createdTaskId}`)
      
      // Wait a moment for the system to generate next occurrence
      await page.waitForTimeout(2000)
      
      // Reload to see updated occurrences
      await page.reload()
      await page.waitForSelector('[data-testid="occurrences-section"]')
      
      // Should now have at least 2 occurrences (completed + new)
      const occurrenceCount = await page.locator('[data-testid="occurrence-row"]').count()
      expect(occurrenceCount).toBeGreaterThanOrEqual(2)
      
      // Check that there's a new pending occurrence
      const pendingOccurrences = page.locator('[data-testid="occurrence-row"]').filter({ hasText: 'Assigned' })
      const pendingCount = await pendingOccurrences.count()
      expect(pendingCount).toBeGreaterThan(0)
    })

    it('should allow user to skip an occurrence with reason', async () => {
      // Find a pending occurrence
      const pendingOccurrence = page.locator('[data-testid="occurrence-row"]').filter({ hasText: 'Assigned' }).first()
      const skipOccurrenceId = await pendingOccurrence.getAttribute('data-occurrence-id')
      
      // Navigate to that occurrence
      await page.goto(`/occurrences/${skipOccurrenceId}`)
      
      // Click skip button
      await page.click('[data-testid="skip-occurrence-button"]')
      
      // Fill skip reason modal
      await page.fill('[data-testid="skip-reason"]', 'House was already clean')
      await page.click('[data-testid="confirm-skip-button"]')
      
      // Wait for skip to process
      await page.waitForSelector('[data-testid="occurrence-skipped-success"]')
      
      // Verify status changed to skipped
      await expect(page.locator('[data-testid="occurrence-status"]')).toContainText('Skipped')
      
      // Verify skip reason appears in timeline
      const timeline = page.locator('[data-testid="occurrence-timeline"]')
      await expect(timeline).toContainText('skipped')
      await expect(timeline).toContainText('House was already clean')
    })

    it('should allow user to add comments to occurrence', async () => {
      // Navigate to any occurrence detail page
      await page.goto(`/occurrences/${createdOccurrenceId}`)
      
      // Add a comment
      await page.fill('[data-testid="comment-input"]', 'This task took longer than expected')
      await page.click('[data-testid="add-comment-button"]')
      
      // Wait for comment to be added
      await page.waitForSelector('[data-testid="comment-added-success"]')
      
      // Verify comment appears in timeline
      const timeline = page.locator('[data-testid="occurrence-timeline"]')
      await expect(timeline).toContainText('This task took longer than expected')
      await expect(timeline).toContainText(testUsers.member.name)
    })

    it('should allow user to pause and unpause task', async () => {
      // Navigate to task detail page
      await page.goto(`/tasks/${createdTaskId}`)
      
      // Pause the task
      await page.click('[data-testid="pause-task-button"]')
      await page.waitForSelector('[data-testid="task-paused-success"]')
      
      // Verify task status shows as paused
      await expect(page.locator('[data-testid="task-status"]')).toContainText('Paused')
      
      // Verify pause button is now unpause button
      await expect(page.locator('[data-testid="unpause-task-button"]')).toBeVisible()
      
      // Unpause the task
      await page.click('[data-testid="unpause-task-button"]')
      await page.waitForSelector('[data-testid="task-unpaused-success"]')
      
      // Verify task status shows as active
      await expect(page.locator('[data-testid="task-status"]')).toContainText('Active')
    })

    it('should show task in household dashboard', async () => {
      // Navigate to dashboard
      await page.goto('/home')
      
      // Check that the created task appears in recent tasks or upcoming occurrences
      const dashboard = page.locator('[data-testid="dashboard-content"]')
      await expect(dashboard).toContainText('Weekly House Cleaning')
      
      // Check for any pending occurrences
      const upcomingSection = page.locator('[data-testid="upcoming-occurrences"]')
      if (await upcomingSection.isVisible()) {
        // Should show some upcoming occurrences for our recurring task
        const occurrenceCount = await upcomingSection.locator('[data-testid="occurrence-item"]').count()
        expect(occurrenceCount).toBeGreaterThan(0)
      }
    })

    it('should allow filtering and searching tasks', async () => {
      // Navigate to tasks page
      await page.goto('/tasks')
      
      // Test search functionality
      await page.fill('[data-testid="task-search"]', 'cleaning')
      await page.waitForTimeout(500) // Wait for search to process
      
      // Should find our cleaning task
      const searchResults = page.locator('[data-testid="task-row"]')
      const searchCount = await searchResults.count()
      expect(searchCount).toBeGreaterThan(0)
      
      // Clear search
      await page.fill('[data-testid="task-search"]', '')
      
      // Test category filter
      await page.selectOption('[data-testid="category-filter"]', testCategories.cleaning.id)
      await page.waitForTimeout(500)
      
      // Should show tasks in cleaning category
      const categoryResults = page.locator('[data-testid="task-row"]')
      const categoryCount = await categoryResults.count()
      expect(categoryCount).toBeGreaterThan(0)
    })

    it('should handle task deletion (soft delete)', async () => {
      // Navigate to task detail page
      await page.goto(`/tasks/${createdTaskId}`)
      
      // Delete the task
      await page.click('[data-testid="delete-task-button"]')
      
      // Confirm deletion in modal
      await page.click('[data-testid="confirm-delete-button"]')
      await page.waitForSelector('[data-testid="task-deleted-success"]')
      
      // Should redirect to tasks list
      await expect(page).toHaveURL('/tasks')
      
      // Task should not appear in active tasks list
      const taskRows = page.locator('[data-testid="task-row"]')
      const ourTask = taskRows.filter({ hasText: 'Weekly House Cleaning' })
      await expect(ourTask).not.toBeVisible()
    })
  })

  describe('User Experience Features', () => {
    it('should show notification preferences page', async () => {
      // Navigate to profile page
      await page.goto('/profile')
      
      // Check notification preferences section exists
      await expect(page.locator('[data-testid="notification-preferences"]')).toBeVisible()
      
      // Test changing a preference
      await page.selectOption('[data-testid="task-created-pref"]', 'none')
      await page.click('[data-testid="save-preferences-button"]')
      
      // Wait for save confirmation
      await page.waitForSelector('[data-testid="preferences-saved-success"]')
      
      // Verify preference was saved
      await page.reload()
      const savedValue = await page.locator('[data-testid="task-created-pref"]').inputValue()
      expect(savedValue).toBe('none')
    })

    it('should provide accessible navigation', async () => {
      // Test main navigation links
      await page.goto('/')
      
      await page.click('[data-testid="nav-tasks"]')
      await expect(page).toHaveURL('/tasks')
      
      await page.click('[data-testid="nav-occurrences"]')
      await expect(page).toHaveURL('/occurrences')
      
      await page.click('[data-testid="nav-household"]')
      await expect(page).toHaveURL('/household')
      
      await page.click('[data-testid="nav-profile"]')
      await expect(page).toHaveURL('/profile')
    })
  })
})