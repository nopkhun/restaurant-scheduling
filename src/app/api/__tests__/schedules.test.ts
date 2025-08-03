/**
 * Integration tests for schedules API endpoints
 * Tests the full API functionality including authentication, validation, and database operations
 */

import { createMocks } from 'node-mocks-http'
import { GET, POST, PATCH, DELETE } from '../schedules/route'
import { GET as GET_BY_ID, PATCH as PATCH_BY_ID, DELETE as DELETE_BY_ID } from '../schedules/[id]/route'

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
}

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: () => mockSupabase,
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

describe('/api/schedules', () => {
  const mockManager = {
    id: 'manager-123',
    role: 'manager',
    branch_id: 'branch-123',
  }

  const mockEmployee = {
    id: 'employee-123',
    role: 'employee',
    branch_id: 'branch-123',
  }

  const mockSchedule = {
    id: 'schedule-123',
    employee_id: 'employee-123',
    branch_id: 'branch-123',
    shift_date: '2024-01-15',
    start_time: '09:00',
    end_time: '17:00',
    status: 'scheduled',
    created_by: 'manager-123',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/schedules', () => {
    test('should return schedules for authenticated manager', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'manager-123' } } },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockManager,
          error: null,
        }),
      })

      // Mock schedules query
      const mockSchedulesQuery = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [mockSchedule],
          error: null,
        }),
      }

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockManager,
              error: null,
            }),
          }
        }
        if (table === 'schedules') {
          return mockSchedulesQuery
        }
        return mockSupabase.from()
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/schedules?start_date=2024-01-01&end_date=2024-01-31',
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.schedules).toHaveLength(1)
      expect(data.schedules[0]).toMatchObject(mockSchedule)
    })

    test('should return 401 for unauthenticated request', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/schedules',
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    test('should filter schedules by employee for employee role', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'employee-123' } } },
        error: null,
      })

      const mockSchedulesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [mockSchedule],
          error: null,
        }),
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
        if (table === 'schedules') {
          return mockSchedulesQuery
        }
        return mockSupabase.from()
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/schedules',
      })

      const response = await GET(req)

      expect(response.status).toBe(200)
      expect(mockSchedulesQuery.eq).toHaveBeenCalledWith('employee_id', 'employee-123')
    })
  })

  describe('POST /api/schedules', () => {
    const newScheduleData = {
      employee_id: 'employee-123',
      branch_id: 'branch-123',
      shift_date: '2024-01-15',
      start_time: '09:00',
      end_time: '17:00',
    }

    test('should create schedule for manager', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'manager-123' } } },
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockManager,
              error: null,
            }),
          }
        }
        if (table === 'schedules') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...mockSchedule, ...newScheduleData },
              error: null,
            }),
          }
        }
        return mockSupabase.from()
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: newScheduleData,
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.schedule).toMatchObject(newScheduleData)
      expect(data.message).toContain('created successfully')
    })

    test('should return 403 for employee creating schedule', async () => {
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
        body: newScheduleData,
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('permission')
    })

    test('should return 400 for invalid data', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'manager-123' } } },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockManager,
          error: null,
        }),
      })

      const invalidData = {
        employee_id: '', // Invalid - empty string
        shift_date: 'invalid-date',
        start_time: '25:00', // Invalid time
      }

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: invalidData,
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('validation')
    })
  })

  describe('GET /api/schedules/[id]', () => {
    test('should return specific schedule', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'manager-123' } } },
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockManager,
              error: null,
            }),
          }
        }
        if (table === 'schedules') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockSchedule,
              error: null,
            }),
          }
        }
        return mockSupabase.from()
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/schedules/schedule-123',
      })

      const response = await GET_BY_ID(req, { params: { id: 'schedule-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.schedule).toMatchObject(mockSchedule)
    })

    test('should return 404 for non-existent schedule', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'manager-123' } } },
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockManager,
              error: null,
            }),
          }
        }
        if (table === 'schedules') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }, // Not found
            }),
          }
        }
        return mockSupabase.from()
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/schedules/non-existent-id',
      })

      const response = await GET_BY_ID(req, { params: { id: 'non-existent-id' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })
  })

  describe('PATCH /api/schedules/[id]', () => {
    test('should update schedule for manager', async () => {
      const updateData = {
        start_time: '10:00',
        end_time: '18:00',
        status: 'confirmed',
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'manager-123' } } },
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockManager,
              error: null,
            }),
          }
        }
        if (table === 'schedules') {
          return {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { ...mockSchedule, ...updateData },
              error: null,
            }),
          }
        }
        return mockSupabase.from()
      })

      const { req } = createMocks({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: updateData,
      })

      const response = await PATCH_BY_ID(req, { params: { id: 'schedule-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.schedule).toMatchObject(updateData)
      expect(data.message).toContain('updated successfully')
    })

    test('should return 403 for employee updating schedule', async () => {
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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: { status: 'confirmed' },
      })

      const response = await PATCH_BY_ID(req, { params: { id: 'schedule-123' } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('permission')
    })
  })

  describe('DELETE /api/schedules/[id]', () => {
    test('should delete schedule for manager', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'manager-123' } } },
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockManager,
              error: null,
            }),
          }
        }
        if (table === 'schedules') {
          return {
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockSchedule,
              error: null,
            }),
          }
        }
        return mockSupabase.from()
      })

      const { req } = createMocks({
        method: 'DELETE',
      })

      const response = await DELETE_BY_ID(req, { params: { id: 'schedule-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toContain('deleted successfully')
    })

    test('should return 403 for employee deleting schedule', async () => {
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
        method: 'DELETE',
      })

      const response = await DELETE_BY_ID(req, { params: { id: 'schedule-123' } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('permission')
    })
  })

  describe('Error handling', () => {
    test('should handle database errors gracefully', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'manager-123' } } },
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockManager,
              error: null,
            }),
          }
        }
        if (table === 'schedules') {
          return {
            select: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' },
            }),
          }
        }
        return mockSupabase.from()
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/schedules',
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to fetch schedules')
    })

    test('should handle authentication errors', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Auth error' },
      })

      const { req } = createMocks({
        method: 'GET',
        url: '/api/schedules',
      })

      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })
})