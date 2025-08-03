/**
 * Integration tests for time tracking clock-in API endpoint
 * Tests GPS verification, location validation, and time entry creation
 */

import { createMocks } from 'node-mocks-http'
import { POST } from '../timesheet/clock-in/route'

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
}

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: () => mockSupabase,
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

// Mock location verification
const mockLocationUtils = {
  verifyLocation: jest.fn(),
  detectSuspiciousMovement: jest.fn(),
}

jest.mock('@/lib/location/utils', () => mockLocationUtils)

// Mock anti-spoofing utilities
const mockAntiSpoofing = {
  performAntiSpoofingChecks: jest.fn(),
  logSuspiciousActivity: jest.fn(),
}

jest.mock('@/lib/location/anti-spoofing', () => mockAntiSpoofing)

describe('/api/timesheet/clock-in', () => {
  const mockEmployee = {
    id: 'employee-123',
    role: 'employee',
    branch_id: 'branch-123',
    full_name: 'John Doe',
  }

  const mockBranch = {
    id: 'branch-123',
    name: 'Main Branch',
    address: '123 Main St',
    latitude: 13.7563,
    longitude: 100.5018,
    location_verification_radius: 50,
  }

  const mockValidLocation = {
    latitude: 13.7565,
    longitude: 100.5020,
  }

  const mockLocationVerificationResult = {
    verified: true,
    distance: 25,
    accuracy: 15,
  }

  const mockAntiSpoofingResult = {
    passed: true,
    riskScore: 0.1,
    checks: {
      gpsSignalStrength: 'strong',
      movementPattern: 'normal',
      deviceSensors: 'consistent',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default successful mocks
    mockLocationUtils.verifyLocation.mockResolvedValue(mockLocationVerificationResult)
    mockLocationUtils.detectSuspiciousMovement.mockReturnValue(false)
    mockAntiSpoofing.performAntiSpoofingChecks.mockResolvedValue(mockAntiSpoofingResult)
  })

  describe('POST /api/timesheet/clock-in', () => {
    test('should successfully clock in with valid location', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'employee-123' } } },
        error: null,
      })

      // Mock database queries
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockEmployee,
              error: null,
            }),
          }
        }
        if (table === 'branches') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockBranch,
              error: null,
            }),
          }
        }
        if (table === 'time_entries') {
          if (arguments[1] && arguments[1].select) {
            // Query for existing active entry
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null, // No active entry
                error: { code: 'PGRST116' },
              }),
            }
          } else {
            // Insert new entry
            return {
              insert: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'entry-123',
                  employee_id: 'employee-123',
                  clock_in_time: new Date().toISOString(),
                  location_verified: true,
                  verification_details: mockLocationVerificationResult,
                },
                error: null,
              }),
            }
          }
        }
        return mockSupabase.from()
      })

      const requestBody = {
        location: mockValidLocation,
        accuracy: 15,
        notes: 'Starting morning shift',
      }

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.message).toContain('Clocked in successfully')
      expect(data.time_entry).toBeDefined()
      expect(data.time_entry.location_verified).toBe(true)
      expect(data.location_verification).toMatchObject(mockLocationVerificationResult)

      // Verify location verification was called
      expect(mockLocationUtils.verifyLocation).toHaveBeenCalledWith(
        mockValidLocation,
        15,
        { latitude: mockBranch.latitude, longitude: mockBranch.longitude },
        mockBranch.location_verification_radius
      )

      // Verify anti-spoofing checks were performed
      expect(mockAntiSpoofing.performAntiSpoofingChecks).toHaveBeenCalled()
    })

    test('should return 401 for unauthenticated request', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { location: mockValidLocation },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    test('should return 400 for missing location data', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'employee-123' } } },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockEmployee,
          error: null,
        }),
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {}, // Missing location
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Location is required')
    })

    test('should return 409 if already clocked in', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'employee-123' } } },
        error: null,
      })

      const existingEntry = {
        id: 'existing-entry',
        employee_id: 'employee-123',
        clock_in_time: '2024-01-15T09:00:00Z',
        clock_out_time: null,
      }

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockEmployee,
              error: null,
            }),
          }
        }
        if (table === 'time_entries') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: existingEntry,
              error: null,
            }),
          }
        }
        return mockSupabase.from()
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { location: mockValidLocation, accuracy: 15 },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toContain('already clocked in')
      expect(data.existing_entry).toMatchObject(existingEntry)
    })

    test('should reject clock-in with failed location verification', async () => {
      const failedVerification = {
        verified: false,
        reason: 'OUTSIDE_LOCATION_RADIUS',
        distance: 150,
        accuracy: 15,
      }

      mockLocationUtils.verifyLocation.mockResolvedValue(failedVerification)

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'employee-123' } } },
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockEmployee,
              error: null,
            }),
          }
        }
        if (table === 'branches') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockBranch,
              error: null,
            }),
          }
        }
        if (table === 'time_entries' && arguments[1] && arguments[1].select) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }
        }
        return mockSupabase.from()
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { location: { latitude: 13.8000, longitude: 100.6000 }, accuracy: 15 },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Location verification failed')
      expect(data.verification_result).toMatchObject(failedVerification)
    })

    test('should detect and reject suspicious location movement', async () => {
      mockLocationUtils.detectSuspiciousMovement.mockReturnValue(true)

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'employee-123' } } },
        error: null,
      })

      // Mock previous location entry
      const previousEntry = {
        id: 'prev-entry',
        employee_id: 'employee-123',
        latitude: 18.7883, // Chiang Mai - very far from Bangkok
        longitude: 98.9853,
        clock_in_time: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      }

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockEmployee,
              error: null,
            }),
          }
        }
        if (table === 'time_entries') {
          if (arguments[1] && arguments[1].select && arguments[1].select.includes('latitude')) {
            // Query for previous location
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: previousEntry,
                error: null,
              }),
            }
          } else if (arguments[1] && arguments[1].select) {
            // Query for active entry
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }
          }
        }
        return mockSupabase.from()
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { location: mockValidLocation, accuracy: 15 },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Suspicious location movement detected')
      expect(mockAntiSpoofing.logSuspiciousActivity).toHaveBeenCalled()
    })

    test('should reject clock-in with failed anti-spoofing checks', async () => {
      const failedAntiSpoofing = {
        passed: false,
        riskScore: 0.8,
        checks: {
          gpsSignalStrength: 'weak',
          movementPattern: 'suspicious',
          deviceSensors: 'inconsistent',
        },
        reasons: ['GPS signal too weak', 'Inconsistent device sensors'],
      }

      mockAntiSpoofing.performAntiSpoofingChecks.mockResolvedValue(failedAntiSpoofing)

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'employee-123' } } },
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockEmployee,
              error: null,
            }),
          }
        }
        if (table === 'branches') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockBranch,
              error: null,
            }),
          }
        }
        if (table === 'time_entries' && arguments[1] && arguments[1].select) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }
        }
        return mockSupabase.from()
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { location: mockValidLocation, accuracy: 15 },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Location spoofing detected')
      expect(data.anti_spoofing_result).toMatchObject(failedAntiSpoofing)
      expect(mockAntiSpoofing.logSuspiciousActivity).toHaveBeenCalled()
    })

    test('should allow clock-in without location verification if disabled for branch', async () => {
      const branchWithoutVerification = {
        ...mockBranch,
        location_verification_radius: null, // Verification disabled
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'employee-123' } } },
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockEmployee,
              error: null,
            }),
          }
        }
        if (table === 'branches') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: branchWithoutVerification,
              error: null,
            }),
          }
        }
        if (table === 'time_entries') {
          if (arguments[1] && arguments[1].select) {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }
          } else {
            return {
              insert: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'entry-123',
                  employee_id: 'employee-123',
                  clock_in_time: new Date().toISOString(),
                  location_verified: false, // No verification required
                },
                error: null,
              }),
            }
          }
        }
        return mockSupabase.from()
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { notes: 'Remote work day' }, // No location provided
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.time_entry.location_verified).toBe(false)
      expect(mockLocationUtils.verifyLocation).not.toHaveBeenCalled()
    })

    test('should handle database errors gracefully', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'employee-123' } } },
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockEmployee,
              error: null,
            }),
          }
        }
        if (table === 'time_entries') {
          if (arguments[1] && arguments[1].select) {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }
          } else {
            return {
              insert: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database insert failed' },
              }),
            }
          }
        }
        return mockSupabase.from()
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { location: mockValidLocation, accuracy: 15 },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to create time entry')
    })
  })
})