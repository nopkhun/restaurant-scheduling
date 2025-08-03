/**
 * E2E tests for time tracking functionality
 * Tests clock in/out flows, location verification, and timesheet management
 */

import { test, expect, type Page } from '@playwright/test'

test.describe('Time Tracking', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant location permission
    await context.grantPermissions(['geolocation'])
    
    // Mock geolocation to a valid workplace location
    await page.setGeolocation({ latitude: 13.7563, longitude: 100.5018 })
    
    // Navigate to timesheet page (assuming user is logged in)
    await page.goto('/dashboard/timesheet')
  })

  test('should display time clock interface', async ({ page }) => {
    // Should show the time clock component
    await expect(page.getByText(/time clock/i)).toBeVisible()
    
    // Should show current date and time
    await expect(page.locator('[data-testid="current-time"]')).toBeVisible()
    
    // Should show clock in button when not clocked in
    await expect(page.getByRole('button', { name: /clock in/i })).toBeVisible()
  })

  test('should handle successful clock in', async ({ page }) => {
    // Mock successful API response
    await page.route('**/api/timesheet/clock-in', route => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          time_entry: {
            id: 'entry-123',
            clock_in_time: new Date().toISOString(),
            location_verified: true,
          },
          message: 'Clocked in successfully',
          location_verification: {
            verified: true,
            distance: 25,
            accuracy: 15,
          },
        }),
      })
    })

    // Click clock in button
    await page.getByRole('button', { name: /clock in/i }).click()

    // Should show loading state
    await expect(page.getByText(/getting location/i)).toBeVisible()

    // Should show success message
    await expect(page.getByText(/clocked in successfully/i)).toBeVisible()

    // Should now show clock out button
    await expect(page.getByRole('button', { name: /clock out/i })).toBeVisible()

    // Should show working timer
    await expect(page.getByText(/currently working/i)).toBeVisible()
  })

  test('should handle location permission denial', async ({ page, context }) => {
    // Revoke location permission
    await context.clearPermissions()

    await page.getByRole('button', { name: /clock in/i }).click()

    // Should show location permission request
    await expect(page.getByText(/location permission required/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /enable location/i })).toBeVisible()

    // Should offer manual clock in option
    await expect(page.getByText(/clock in without location/i)).toBeVisible()
  })

  test('should handle clock in outside work location', async ({ page }) => {
    // Set location far from workplace
    await page.setGeolocation({ latitude: 18.7883, longitude: 98.9853 }) // Chiang Mai

    // Mock location verification failure
    await page.route('**/api/timesheet/clock-in', route => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Location verification failed',
          verification_result: {
            verified: false,
            reason: 'OUTSIDE_LOCATION_RADIUS',
            distance: 587000, // 587km away
            accuracy: 15,
          },
        }),
      })
    })

    await page.getByRole('button', { name: /clock in/i }).click()

    // Should show location verification error
    await expect(page.getByText(/location verification failed/i)).toBeVisible()
    await expect(page.getByText(/not within the required distance/i)).toBeVisible()

    // Should show distance information
    await expect(page.getByText(/587/)).toBeVisible() // Distance in km
  })

  test('should handle poor GPS accuracy', async ({ page }) => {
    // Mock location with poor accuracy
    await page.evaluateOnNewDocument(() => {
      const mockGetCurrentPosition = (success: PositionCallback, error?: PositionErrorCallback) => {
        success({
          coords: {
            latitude: 13.7563,
            longitude: 100.5018,
            accuracy: 1000, // Very poor accuracy
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        })
      }

      Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
        value: mockGetCurrentPosition,
        writable: true,
      })
    })

    await page.getByRole('button', { name: /clock in/i }).click()

    // Should show GPS accuracy warning
    await expect(page.getByText(/gps accuracy too low/i)).toBeVisible()
    await expect(page.getByText(/1000m/)).toBeVisible() // Accuracy value

    // Should suggest moving to better location
    await expect(page.getByText(/move to an area with better/i)).toBeVisible()
  })

  test('should allow manual clock in when location verification is disabled', async ({ page }) => {
    // Mock manual clock in response
    await page.route('**/api/timesheet/clock-in', route => {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          time_entry: {
            id: 'entry-123',
            clock_in_time: new Date().toISOString(),
            location_verified: false,
            manual_entry: true,
          },
          message: 'Clocked in manually',
        }),
      })
    })

    // Click manual clock in
    await page.getByRole('button', { name: /clock in without location/i }).click()

    // Should show confirmation
    await expect(page.getByText(/clocked in manually/i)).toBeVisible()

    // Should indicate manual entry
    await expect(page.getByText(/manual entry/i)).toBeVisible()
  })

  test('should handle successful clock out', async ({ page }) => {
    // First set up a clocked in state
    await page.route('**/api/timesheet/active', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          time_entry: {
            id: 'entry-123',
            clock_in_time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
            clock_out_time: null,
          },
        }),
      })
    })

    // Mock successful clock out
    await page.route('**/api/timesheet/clock-out', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          time_entry: {
            id: 'entry-123',
            clock_in_time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            clock_out_time: new Date().toISOString(),
            total_hours: 4.0,
          },
          message: 'Clocked out successfully',
        }),
      })
    })

    await page.reload()

    // Should show clock out button
    await expect(page.getByRole('button', { name: /clock out/i })).toBeVisible()

    // Should show working time
    await expect(page.getByText(/4:00/)).toBeVisible()

    // Click clock out
    await page.getByRole('button', { name: /clock out/i }).click()

    // Should show success message
    await expect(page.getByText(/clocked out successfully/i)).toBeVisible()

    // Should show completed shift summary
    await expect(page.getByText(/4\.0 hours/)).toBeVisible()
  })

  test('should add notes to time entries', async ({ page }) => {
    // Open notes section
    await page.getByRole('button', { name: /add notes/i }).click()

    // Should show notes input
    const notesInput = page.getByPlaceholder(/add a note/i)
    await expect(notesInput).toBeVisible()

    // Type notes
    await notesInput.fill('Starting morning shift at reception desk')

    // Mock API call with notes
    await page.route('**/api/timesheet/clock-in', route => {
      const request = route.request()
      const body = JSON.parse(request.postData() || '{}')
      
      expect(body.notes).toBe('Starting morning shift at reception desk')
      
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          time_entry: {
            id: 'entry-123',
            clock_in_time: new Date().toISOString(),
            notes: body.notes,
          },
          message: 'Clocked in successfully',
        }),
      })
    })

    await page.getByRole('button', { name: /clock in/i }).click()

    // Should include notes in the time entry
    await expect(page.getByText(/starting morning shift/i)).toBeVisible()
  })

  test('should display timesheet history', async ({ page }) => {
    // Mock timesheet entries
    await page.route('**/api/timesheet/entries**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entries: [
            {
              id: 'entry-1',
              shift_date: '2024-01-15',
              clock_in_time: '2024-01-15T09:00:00Z',
              clock_out_time: '2024-01-15T17:00:00Z',
              total_hours: 8.0,
              status: 'completed',
            },
            {
              id: 'entry-2',
              shift_date: '2024-01-14',
              clock_in_time: '2024-01-14T09:30:00Z',
              clock_out_time: '2024-01-14T17:30:00Z',
              total_hours: 8.0,
              status: 'completed',
            },
          ],
          pagination: {
            total: 2,
            page: 1,
            totalPages: 1,
          },
        }),
      })
    })

    // Navigate to timesheet history
    await page.getByRole('tab', { name: /history/i }).click()

    // Should show timesheet entries
    await expect(page.getByText(/january 15/i)).toBeVisible()
    await expect(page.getByText(/january 14/i)).toBeVisible()

    // Should show hours worked
    await expect(page.getByText(/8\.0 hours/)).toBeVisible()

    // Should show times
    await expect(page.getByText(/09:00/)).toBeVisible()
    await expect(page.getByText(/17:00/)).toBeVisible()
  })

  test('should handle break reminders', async ({ page }) => {
    // Mock long working session (over 5 hours)
    await page.route('**/api/timesheet/active', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          time_entry: {
            id: 'entry-123',
            clock_in_time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
            clock_out_time: null,
          },
        }),
      })
    })

    await page.reload()

    // Should show break reminder
    await expect(page.getByText(/break reminder/i)).toBeVisible()
    await expect(page.getByText(/working for over 5 hours/i)).toBeVisible()

    // Should have take break button
    await expect(page.getByRole('button', { name: /take break/i })).toBeVisible()
  })

  test('should show working time updates in real-time', async ({ page }) => {
    // Mock active time entry
    await page.route('**/api/timesheet/active', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          time_entry: {
            id: 'entry-123',
            clock_in_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
            clock_out_time: null,
          },
        }),
      })
    })

    await page.reload()

    // Should show current working time
    const workingTime = page.getByTestId('working-time')
    await expect(workingTime).toBeVisible()

    // Should show approximately 30 minutes (00:30:xx)
    await expect(workingTime).toContainText('0:30')

    // Wait a few seconds and verify time updates
    await page.waitForTimeout(2000)
    await expect(workingTime).toContainText('0:30') // Should still be around 30 minutes
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network error
    await page.route('**/api/timesheet/clock-in', route => route.abort())

    await page.getByRole('button', { name: /clock in/i }).click()

    // Should show network error message
    await expect(page.getByText(/unable to connect|network error/i)).toBeVisible()

    // Should suggest trying again
    await expect(page.getByText(/try again/i)).toBeVisible()
  })
})

test.describe('Time Tracking - Mobile', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Grant location permission
    await context.grantPermissions(['geolocation'])
    await page.setGeolocation({ latitude: 13.7563, longitude: 100.5018 })
    
    await page.goto('/dashboard/timesheet')
  })

  test('should work correctly on mobile devices', async ({ page }) => {
    // Should display mobile-friendly interface
    await expect(page.getByRole('button', { name: /clock in/i })).toBeVisible()

    // Clock in button should be large enough for touch
    const clockInButton = page.getByRole('button', { name: /clock in/i })
    const buttonBox = await clockInButton.boundingBox()
    expect(buttonBox?.height).toBeGreaterThan(44) // Minimum touch target size

    // Should handle touch interactions
    await clockInButton.tap()

    // Should work with mobile location services
    await expect(page.getByText(/getting location/i)).toBeVisible()
  })
})