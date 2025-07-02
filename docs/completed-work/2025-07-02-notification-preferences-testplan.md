# Test Plan: Notification Preferences UI
**Date:** January 2, 2025  
**Feature:** User notification preferences management interface  
**Test Environment:** Local development with authenticated user

## Prerequisites
- User is logged in with a valid session
- User has access to their profile page
- Backend notification APIs are functional
- At least one other user exists in the household for testing "any" vs "mine" logic

---

## Test Suite 1: Component Loading & Display

### Test 1.1: Initial Load
**Objective:** Verify component loads and displays current preferences

**Steps:**
1. Navigate to user profile page (/profile)
2. Scroll to "Notification Preferences" section
3. Observe loading state

**Expected Results:**
- ✅ Loading spinner appears briefly
- ✅ Form loads with 8 preference options
- ✅ Current preferences are pre-selected in dropdowns
- ✅ Save button is enabled

### Test 1.2: Default Values
**Objective:** Verify default preference values for new users

**Steps:**
1. Create a new user account
2. Navigate to profile page
3. Check notification preferences

**Expected Results:**
- ✅ Task notifications default to "Any task"
- ✅ Occurrence notifications default to "My occurrences only"
- ✅ All dropdowns are populated correctly

---

## Test Suite 2: Preference Updates

### Test 2.1: Save Preferences
**Objective:** Test saving preference changes

**Steps:**
1. Change "Task Created" from "Any task" to "None"
2. Change "Occurrence Assigned" from "My occurrences only" to "Any occurrence"
3. Click "Save Preferences"
4. Observe save process

**Expected Results:**
- ✅ Button text changes to "Saving..."
- ✅ Button is disabled during save
- ✅ Success message appears: "Preferences saved successfully!"
- ✅ Message disappears after 3 seconds
- ✅ Button returns to "Save Preferences"

### Test 2.2: Persistence Check
**Objective:** Verify preferences persist after save

**Steps:**
1. After saving preferences in Test 2.1
2. Navigate away from profile page
3. Return to profile page
4. Check preference values

**Expected Results:**
- ✅ Previously saved values are retained
- ✅ No loading errors occur

### Test 2.3: Multiple Changes
**Objective:** Test saving multiple preference changes at once

**Steps:**
1. Change all 8 preferences to different values
2. Click "Save Preferences"
3. Refresh the page
4. Verify all changes persisted

**Expected Results:**
- ✅ All 8 preferences save correctly
- ✅ No partial saves occur
- ✅ All values persist after refresh

---

## Test Suite 3: Error Handling

### Test 3.1: Network Error
**Objective:** Test handling of network failures

**Steps:**
1. Open browser developer tools
2. Set network to offline mode
3. Change a preference and click Save
4. Observe error handling

**Expected Results:**
- ✅ Error message appears: "Failed to save preferences. Please try again."
- ✅ Message is in red text
- ✅ Form remains interactive
- ✅ Previous values are retained

### Test 3.2: API Error
**Objective:** Test handling of server errors

**Steps:**
1. Temporarily break the API endpoint (e.g., invalid auth)
2. Try to save preferences
3. Observe error handling

**Expected Results:**
- ✅ Error message displays
- ✅ User can retry after fixing the issue
- ✅ No console errors or crashes

---

## Test Suite 4: UI/UX Validation

### Test 4.1: Responsive Design
**Objective:** Verify component works on different screen sizes

**Steps:**
1. Test on desktop (1920x1080)
2. Test on tablet (768x1024)
3. Test on mobile (375x667)

**Expected Results:**
- ✅ Labels and dropdowns remain aligned
- ✅ Save button is accessible on all sizes
- ✅ No horizontal scrolling required

### Test 4.2: Keyboard Navigation
**Objective:** Test accessibility with keyboard

**Steps:**
1. Use Tab key to navigate through preferences
2. Use arrow keys to change dropdown values
3. Press Enter to save

**Expected Results:**
- ✅ All form elements are keyboard accessible
- ✅ Focus indicators are visible
- ✅ Form can be submitted with Enter key

### Test 4.3: Visual Feedback
**Objective:** Verify all visual states work correctly

**Steps:**
1. Hover over dropdowns
2. Click to open dropdown menus
3. Observe save button states

**Expected Results:**
- ✅ Dropdowns show hover states
- ✅ Save button shows hover state
- ✅ Disabled state is visually distinct
- ✅ Success/error messages are clearly visible

---

## Test Suite 5: Integration Testing

### Test 5.1: Notification Behavior
**Objective:** Verify preferences actually control notifications

**Steps:**
1. Set "Task Created" to "None"
2. Save preferences
3. Have another user create a task
4. Check if notification email is received

**Expected Results:**
- ✅ No email notification received
- ✅ Other users with "Any task" setting receive notification

### Test 5.2: "Mine" vs "Any" Logic
**Objective:** Test occurrence notification filtering

**Steps:**
1. Set "Occurrence Executed" to "Mine"
2. Complete an occurrence assigned to you
3. Have another user complete their occurrence
4. Check notifications

**Expected Results:**
- ✅ Receive notification for your own occurrence
- ✅ No notification for other user's occurrence
- ✅ Users with "Any" setting receive both

---

## Edge Cases

### Test 6.1: Rapid Clicks
**Objective:** Test handling of multiple save attempts

**Steps:**
1. Click "Save Preferences" multiple times rapidly

**Expected Results:**
- ✅ Only one save request is processed
- ✅ No duplicate success messages
- ✅ No errors or race conditions

### Test 6.2: Stale Data
**Objective:** Test concurrent updates from multiple sessions

**Steps:**
1. Open profile in two browser tabs
2. Change preferences in Tab 1 and save
3. Change different preferences in Tab 2 and save
4. Refresh both tabs

**Expected Results:**
- ✅ Last save wins (expected behavior)
- ✅ No corruption of preferences
- ✅ Both tabs show final state after refresh

---

## Checklist Summary

**Component Functionality:**
- [ ] Loads current preferences correctly
- [ ] Saves all preference types
- [ ] Shows appropriate loading/saving states
- [ ] Displays success/error messages
- [ ] Auto-clears messages after 3 seconds

**Error Handling:**
- [ ] Handles network failures gracefully
- [ ] Shows user-friendly error messages
- [ ] Allows retry after errors

**User Experience:**
- [ ] Responsive on all screen sizes
- [ ] Keyboard accessible
- [ ] Clear visual feedback
- [ ] No console errors

**Integration:**
- [ ] Preferences control actual notification behavior
- [ ] "Mine" vs "Any" logic works correctly
- [ ] Changes persist across sessions