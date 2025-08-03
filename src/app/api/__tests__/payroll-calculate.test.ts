/**
 * Integration tests for payroll calculation API endpoint
 * Tests the full payroll calculation flow including time entry aggregation and tax calculations
 */

import { createMocks } from 'node-mocks-http'
import { POST } from '../payroll/calculate/route'

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
}

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: () => mockSupabase,
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

// Mock PayrollCalculator
const mockPayrollCalculator = {
  calculateHoursBreakdown: jest.fn(),
  calculatePayroll: jest.fn(),
  validateInput: jest.fn(),
}

jest.mock('@/lib/payroll/calculations', () => ({
  PayrollCalculator: mockPayrollCalculator,
}))

describe('/api/payroll/calculate', () => {
  const mockAccountingUser = {
    id: 'accounting-123',
    role: 'accounting',
    branch_id: null, // Corporate user
  }

  const mockEmployee = {
    id: 'employee-123',
    role: 'employee',
    branch_id: 'branch-123',
    hourly_rate: 150,
  }

  const mockTimeEntries = [
    {
      id: 'entry-1',
      employee_id: 'employee-123',
      clock_in_time: '2024-01-15T09:00:00Z',
      clock_out_time: '2024-01-15T17:00:00Z',
      total_hours: 8,
      shift_date: '2024-01-15',
      is_holiday: false,
    },
    {
      id: 'entry-2',
      employee_id: 'employee-123',
      clock_in_time: '2024-01-16T09:00:00Z',
      clock_out_time: '2024-01-16T19:00:00Z',
      total_hours: 10,
      shift_date: '2024-01-16',
      is_holiday: false,
    },
    {
      id: 'entry-3',
      employee_id: 'employee-123',
      clock_in_time: '2024-01-20T09:00:00Z',
      clock_out_time: '2024-01-20T17:00:00Z',
      total_hours: 8,
      shift_date: '2024-01-20',
      is_holiday: true,
    },
  ]

  const mockHoursBreakdown = {
    totalHours: 26,
    regularHours: 16,
    overtimeHours: 2,
    holidayHours: 8,
  }

  const mockPayrollResult = {
    regularHours: 16,
    overtimeHours: 2,
    holidayHours: 8,
    regularPay: 2400, // 16 * 150
    overtimePay: 450, // 2 * 150 * 1.5
    holidayPay: 2400, // 8 * 150 * 2
    grossSalary: 5250,
    socialSecurity: 262.5, // 5% capped at 750
    taxDeduction: 100,
    salaryAdvances: 1000,
    otherDeductions: 0,
    totalDeductions: 1362.5,
    netSalary: 3887.5,
    rates: {
      regularRate: 150,
      overtimeRate: 225,
      holidayRate: 300,
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default successful validations
    mockPayrollCalculator.validateInput.mockReturnValue([])
    mockPayrollCalculator.calculateHoursBreakdown.mockReturnValue(mockHoursBreakdown)
    mockPayrollCalculator.calculatePayroll.mockReturnValue(mockPayrollResult)
  })

  describe('POST /api/payroll/calculate', () => {
    test('should calculate payroll for valid request', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'accounting-123' } } },
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockAccountingUser,
              error: null,
            }),
          }
        }
        if (table === 'time_entries') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            mockResolvedValue: {
              data: mockTimeEntries,
              error: null,
            },
          }
        }
        return mockSupabase.from()
      })

      // Mock time entries query result
      const mockTimeEntriesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
      }
      mockTimeEntriesQuery.lte = jest.fn().mockResolvedValue({
        data: mockTimeEntries,
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockAccountingUser,
              error: null,
            }),
          }
        }
        if (table === 'time_entries') {
          return mockTimeEntriesQuery
        }
        return mockSupabase.from()
      })

      const requestBody = {
        employee_id: 'employee-123',
        period_start: '2024-01-01',
        period_end: '2024-01-31',
        hourly_rate: 150,
        salary_advances: 1000,
      }

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.calculation).toMatchObject(mockPayrollResult)
      expect(data.hours_breakdown).toMatchObject(mockHoursBreakdown)
      expect(data.time_entries_count).toBe(3)

      // Verify calculations were called with correct parameters
      expect(mockPayrollCalculator.calculateHoursBreakdown).toHaveBeenCalledWith(mockTimeEntries)
      expect(mockPayrollCalculator.calculatePayroll).toHaveBeenCalledWith({
        employeeId: 'employee-123',
        regularHours: 16,
        overtimeHours: 2,
        holidayHours: 8,
        hourlyRate: 150,
        salaryAdvances: 1000,
        otherDeductions: 0,
      })
    })

    test('should return 401 for unauthenticated request', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { employee_id: 'employee-123' },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    test('should return 403 for non-accounting user', async () => {
      const mockManagerUser = {
        id: 'manager-123',
        role: 'manager',
        branch_id: 'branch-123',
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'manager-123' } } },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockManagerUser,
          error: null,
        }),
      })

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { employee_id: 'employee-123' },
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('permission')
    })

    test('should return 400 for validation errors', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'accounting-123' } } },
        error: null,
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockAccountingUser,
          error: null,
        }),
      })

      // Mock validation errors
      mockPayrollCalculator.validateInput.mockReturnValue([
        'Employee ID is required',
        'Hourly rate must be greater than 0',
      ])

      const invalidRequestBody = {
        employee_id: '',
        hourly_rate: 0,
      }

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: invalidRequestBody,
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('validation')
      expect(data.validation_errors).toHaveLength(2)
    })

    test('should handle missing time entries', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'accounting-123' } } },
        error: null,
      })

      const mockTimeEntriesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
      }
      mockTimeEntriesQuery.lte = jest.fn().mockResolvedValue({
        data: [], // No time entries
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockAccountingUser,
              error: null,
            }),
          }
        }
        if (table === 'time_entries') {
          return mockTimeEntriesQuery
        }
        return mockSupabase.from()
      })

      const zeroHoursBreakdown = {
        totalHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        holidayHours: 0,
      }

      const zeroPayrollResult = {
        ...mockPayrollResult,
        regularHours: 0,
        overtimeHours: 0,
        holidayHours: 0,
        regularPay: 0,
        overtimePay: 0,
        holidayPay: 0,
        grossSalary: 0,
        socialSecurity: 0,
        taxDeduction: 0,
        netSalary: -1000, // Only deductions (salary advances)
      }

      mockPayrollCalculator.calculateHoursBreakdown.mockReturnValue(zeroHoursBreakdown)
      mockPayrollCalculator.calculatePayroll.mockReturnValue(zeroPayrollResult)

      const requestBody = {
        employee_id: 'employee-123',
        period_start: '2024-01-01',
        period_end: '2024-01-31',
        hourly_rate: 150,
        salary_advances: 1000,
      }

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.time_entries_count).toBe(0)
      expect(data.calculation.grossSalary).toBe(0)
      expect(data.hours_breakdown.totalHours).toBe(0)
    })

    test('should handle default values correctly', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'accounting-123' } } },
        error: null,
      })

      const mockTimeEntriesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
      }
      mockTimeEntriesQuery.lte = jest.fn().mockResolvedValue({
        data: mockTimeEntries,
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockAccountingUser,
              error: null,
            }),
          }
        }
        if (table === 'time_entries') {
          return mockTimeEntriesQuery
        }
        return mockSupabase.from()
      })

      // Request with minimal data - should use defaults
      const requestBody = {
        employee_id: 'employee-123',
        hourly_rate: 150,
        // No period dates, salary advances, or other deductions
      }

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      })

      const response = await POST(req)

      expect(response.status).toBe(200)
      
      // Verify default values were used
      expect(mockPayrollCalculator.calculatePayroll).toHaveBeenCalledWith(
        expect.objectContaining({
          salaryAdvances: 0,
          otherDeductions: 0,
        })
      )
    })

    test('should handle database errors gracefully', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'accounting-123' } } },
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockAccountingUser,
              error: null,
            }),
          }
        }
        if (table === 'time_entries') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' },
            }),
          }
        }
        return mockSupabase.from()
      })

      const requestBody = {
        employee_id: 'employee-123',
        hourly_rate: 150,
      }

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to fetch time entries')
    })

    test('should include period information in response', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'accounting-123' } } },
        error: null,
      })

      const mockTimeEntriesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
      }
      mockTimeEntriesQuery.lte = jest.fn().mockResolvedValue({
        data: mockTimeEntries,
        error: null,
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockAccountingUser,
              error: null,
            }),
          }
        }
        if (table === 'time_entries') {
          return mockTimeEntriesQuery
        }
        return mockSupabase.from()
      })

      const requestBody = {
        employee_id: 'employee-123',
        period_start: '2024-01-01',
        period_end: '2024-01-31',
        hourly_rate: 150,
      }

      const { req } = createMocks({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      })

      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.period).toEqual({
        start: '2024-01-01',
        end: '2024-01-31',
      })
      expect(data.employee_id).toBe('employee-123')
      expect(data.calculation_date).toBeDefined()
    })
  })
})