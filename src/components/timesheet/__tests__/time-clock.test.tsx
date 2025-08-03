/**
 * Component tests for TimeClock component
 * Tests user interactions, location verification, and clock in/out functionality
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeClockComponent as TimeClock } from '../time-clock'
import { useAuth } from '@/hooks/use-auth'
import { useLocation } from '@/hooks/use-location'

// Mock the hooks
jest.mock('@/hooks/use-auth')
jest.mock('@/hooks/use-location')

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
  },
}))

// Mock fetch
global.fetch = jest.fn()

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>

describe('TimeClock', () => {
  const mockUser = {
    id: 'employee-123',
    email: 'employee@example.com',
  }

  const mockAuthData = {
    user: mockUser,
    profile: {
      id: 'employee-123',
      full_name: 'John Doe',
      branch_id: 'branch-123',
    },
    loading: false,
    error: null,
    isAuthenticated: true,
    getUserRole: () => 'employee',
    getUserBranchId: () => 'branch-123',
  }

  const mockLocationData = {
    coords: {
      latitude: 13.7563,
      longitude: 100.5018,
    },
    accuracy: 15,
    timestamp: Date.now(),
    loading: false,
    error: null,
    permission: 'granted' as PermissionState,
    supported: true,
    watching: false,
    hasLocation: true,
    isAccurate: true,
    getLocation: jest.fn(),
    verifyLocationAgainstBranch: jest.fn(),
    startWatching: jest.fn(),
    stopWatching: jest.fn(),
    checkPermission: jest.fn(),
    clearLocation: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockUseAuth.mockReturnValue(mockAuthData as any)
    mockUseLocation.mockReturnValue(mockLocationData as any)
    
    // Mock successful fetch responses
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        time_entry: {
          id: 'entry-123',
          clock_in_time: new Date().toISOString(),
          location_verified: true,
        },
        message: 'Clocked in successfully',
      }),
    })
  })

  test('should render clock in button when not clocked in', () => {
    render(<TimeClock />)

    expect(screen.getByText('Clock In')).toBeInTheDocument()
    expect(screen.getByText('Ready to start your shift?')).toBeInTheDocument()
    expect(screen.queryByText('Clock Out')).not.toBeInTheDocument()
  })

  test('should render clock out button when clocked in', () => {
    const activeEntry = {
      id: 'entry-123',
      clock_in_time: '2024-01-15T09:00:00Z',
      clock_out_time: null,
    }

    render(<TimeClock activeEntry={activeEntry} />)

    expect(screen.getByText('Clock Out')).toBeInTheDocument()
    expect(screen.getByText('Currently working')).toBeInTheDocument()
    expect(screen.getByText('Started at 09:00')).toBeInTheDocument()
    expect(screen.queryByText('Clock In')).not.toBeInTheDocument()
  })

  test('should show location permission request when not granted', () => {
    mockUseLocation.mockReturnValue({
      ...mockLocationData,
      permission: 'denied',
      hasLocation: false,
    })

    render(<TimeClock />)

    expect(screen.getByText('Location Permission Required')).toBeInTheDocument()
    expect(screen.getByText('Enable Location')).toBeInTheDocument()
  })

  test('should show location loading state', () => {
    mockUseLocation.mockReturnValue({
      ...mockLocationData,
      loading: true,
      hasLocation: false,
    })

    render(<TimeClock />)

    expect(screen.getByText('Getting your location...')).toBeInTheDocument()
  })

  test('should handle successful clock in', async () => {
    const user = userEvent.setup()
    
    mockLocationData.getLocation.mockResolvedValue({
      coords: mockLocationData.coords,
      accuracy: 15,
      timestamp: Date.now(),
    })

    mockLocationData.verifyLocationAgainstBranch.mockResolvedValue({
      verified: true,
      distance: 25,
      accuracy: 15,
    })

    render(<TimeClock />)

    const clockInButton = screen.getByText('Clock In')
    await user.click(clockInButton)

    await waitFor(() => {
      expect(mockLocationData.getLocation).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/timesheet/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: mockLocationData.coords,
          accuracy: 15,
          notes: '',
        }),
      })
    })
  })

  test('should handle clock in with notes', async () => {
    const user = userEvent.setup()

    render(<TimeClock />)

    // Open notes input
    const notesButton = screen.getByLabelText('Add notes')
    await user.click(notesButton)

    const notesInput = screen.getByPlaceholderText('Add a note for this entry...')
    await user.type(notesInput, 'Starting morning shift')

    const clockInButton = screen.getByText('Clock In')
    await user.click(clockInButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/timesheet/clock-in',
        expect.objectContaining({
          body: expect.stringContaining('Starting morning shift'),
        })
      )
    })
  })

  test('should handle location verification failure', async () => {
    const user = userEvent.setup()

    mockLocationData.verifyLocationAgainstBranch.mockResolvedValue({
      verified: false,
      reason: 'OUTSIDE_LOCATION_RADIUS',
      distance: 150,
      accuracy: 15,
    })

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        error: 'Location verification failed',
        verification_result: {
          verified: false,
          reason: 'OUTSIDE_LOCATION_RADIUS',
          distance: 150,
        },
      }),
    })

    render(<TimeClock />)

    const clockInButton = screen.getByText('Clock In')
    await user.click(clockInButton)

    await waitFor(() => {
      expect(screen.getByText('Location Verification Failed')).toBeInTheDocument()
    })

    expect(screen.getByText('You are not within the required distance of the workplace.')).toBeInTheDocument()
    expect(screen.getByText('Distance: 150m')).toBeInTheDocument()
  })

  test('should handle GPS accuracy too low', async () => {
    const user = userEvent.setup()

    mockLocationData.getLocation.mockResolvedValue({
      coords: mockLocationData.coords,
      accuracy: 500, // Very poor accuracy
      timestamp: Date.now(),
    })

    render(<TimeClock />)

    const clockInButton = screen.getByText('Clock In')
    await user.click(clockInButton)

    await waitFor(() => {
      expect(screen.getByText('GPS Accuracy Too Low')).toBeInTheDocument()
    })

    expect(screen.getByText('Current accuracy: 500m')).toBeInTheDocument()
    expect(screen.getByText('Please move to an area with better GPS signal and try again.')).toBeInTheDocument()
  })

  test('should handle successful clock out', async () => {
    const user = userEvent.setup()
    
    const activeEntry = {
      id: 'entry-123',
      clock_in_time: '2024-01-15T09:00:00Z',
      clock_out_time: null,
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        time_entry: {
          ...activeEntry,
          clock_out_time: new Date().toISOString(),
          total_hours: 8,
        },
        message: 'Clocked out successfully',
      }),
    })

    render(<TimeClock activeEntry={activeEntry} />)

    const clockOutButton = screen.getByText('Clock Out')
    await user.click(clockOutButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/timesheet/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: mockLocationData.coords,
          accuracy: 15,
          notes: '',
        }),
      })
    })
  })

  test('should show manual clock in option when location fails', async () => {
    const user = userEvent.setup()

    mockLocationData.getLocation.mockRejectedValue(new Error('Location access denied'))

    render(<TimeClock />)

    const clockInButton = screen.getByText('Clock In')
    await user.click(clockInButton)

    await waitFor(() => {
      expect(screen.getByText('Location Unavailable')).toBeInTheDocument()
    })

    expect(screen.getByText('Clock In Without Location')).toBeInTheDocument()

    const manualClockInButton = screen.getByText('Clock In Without Location')
    await user.click(manualClockInButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/timesheet/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: null,
          accuracy: null,
          notes: '',
          manual_entry: true,
        }),
      })
    })
  })

  test('should display working hours correctly', () => {
    const activeEntry = {
      id: 'entry-123',
      clock_in_time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
      clock_out_time: null,
    }

    render(<TimeClock activeEntry={activeEntry} />)

    expect(screen.getByText(/4:00:../)).toBeInTheDocument() // Should show approximately 4 hours
  })

  test('should handle network errors gracefully', async () => {
    const user = userEvent.setup()

    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    render(<TimeClock />)

    const clockInButton = screen.getByText('Clock In')
    await user.click(clockInButton)

    await waitFor(() => {
      expect(screen.getByText('Unable to connect to server. Please try again.')).toBeInTheDocument()
    })
  })

  test('should disable buttons during loading', async () => {
    const user = userEvent.setup()

    // Mock a slow response
    ;(global.fetch as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    )

    render(<TimeClock />)

    const clockInButton = screen.getByText('Clock In')
    await user.click(clockInButton)

    await waitFor(() => {
      expect(clockInButton).toBeDisabled()
    })

    expect(screen.getByText('Clocking In...')).toBeInTheDocument()
  })

  test('should show break reminder for long shifts', () => {
    const activeEntry = {
      id: 'entry-123',
      clock_in_time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      clock_out_time: null,
    }

    render(<TimeClock activeEntry={activeEntry} />)

    expect(screen.getByText('Break Reminder')).toBeInTheDocument()
    expect(screen.getByText("You've been working for over 5 hours. Consider taking a break.")).toBeInTheDocument()
  })

  test('should handle location permission request', async () => {
    const user = userEvent.setup()

    mockUseLocation.mockReturnValue({
      ...mockLocationData,
      permission: 'prompt',
      hasLocation: false,
    })

    const mockCheckPermission = jest.fn().mockResolvedValue('granted')
    mockUseLocation.mockReturnValue({
      ...mockLocationData,
      permission: 'prompt',
      hasLocation: false,
      checkPermission: mockCheckPermission,
    })

    render(<TimeClock />)

    const enableLocationButton = screen.getByText('Enable Location')
    await user.click(enableLocationButton)

    await waitFor(() => {
      expect(mockCheckPermission).toHaveBeenCalled()
    })
  })

  test('should show different status for different entry states', () => {
    const completedEntry = {
      id: 'entry-123',
      clock_in_time: '2024-01-15T09:00:00Z',
      clock_out_time: '2024-01-15T17:00:00Z',
      total_hours: 8,
    }

    render(<TimeClock activeEntry={null} lastEntry={completedEntry} />)

    expect(screen.getByText('Previous Shift')).toBeInTheDocument()
    expect(screen.getByText('8.0 hours')).toBeInTheDocument()
    expect(screen.getByText('09:00 - 17:00')).toBeInTheDocument()
  })
})