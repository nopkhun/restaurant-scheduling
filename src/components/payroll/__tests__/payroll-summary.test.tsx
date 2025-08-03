/**
 * Component tests for PayrollSummary component
 * Tests data display, calculations, and user interactions
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PayrollSummary } from '../payroll-summary'

// Mock the hooks and utilities
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'accounting-123' },
    profile: { role: 'accounting' },
    isAuthenticated: true,
    getUserRole: () => 'accounting',
  }),
}))

jest.mock('@/lib/payroll/calculations', () => ({
  PayrollCalculator: {
    formatCurrency: (amount: number) => `₿${amount.toLocaleString()}`,
  },
}))

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

describe('PayrollSummary', () => {
  const mockPayrollData = {
    period: {
      id: 'period-123',
      period_start: '2024-01-01',
      period_end: '2024-01-31',
      status: 'draft',
    },
    entries: [
      {
        id: 'entry-1',
        employee_id: 'emp-1',
        employee: {
          id: 'emp-1',
          full_name: 'John Doe',
          employee_id: 'EMP001',
        },
        regular_hours: 160,
        overtime_hours: 20,
        holiday_hours: 8,
        gross_salary: 30900,
        net_salary: 25500,
        social_security: 750,
        tax_deduction: 1500,
        salary_advances: 3000,
        total_deductions: 5250,
      },
      {
        id: 'entry-2',
        employee_id: 'emp-2',
        employee: {
          id: 'emp-2',
          full_name: 'Jane Smith',
          employee_id: 'EMP002',
        },
        regular_hours: 160,
        overtime_hours: 10,
        holiday_hours: 0,
        gross_salary: 26250,
        net_salary: 22750,
        social_security: 750,
        tax_deduction: 1000,
        salary_advances: 1750,
        total_deductions: 3500,
      },
    ],
    totals: {
      total_employees: 2,
      total_gross: 57150,
      total_net: 48250,
      total_deductions: 8750,
      total_social_security: 1500,
      total_tax: 2500,
      total_advances: 4750,
      total_hours: 358,
      average_hours_per_employee: 179,
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock successful API responses
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        payroll: mockPayrollData,
        message: 'Success',
      }),
    })
  })

  test('should render payroll summary with correct data', () => {
    render(<PayrollSummary payrollData={mockPayrollData} />)

    // Check period information
    expect(screen.getByText('January 2024 Payroll')).toBeInTheDocument()
    expect(screen.getByText('January 1 - January 31, 2024')).toBeInTheDocument()

    // Check totals
    expect(screen.getByText('₿57,150')).toBeInTheDocument() // Total gross
    expect(screen.getByText('₿48,250')).toBeInTheDocument() // Total net
    expect(screen.getByText('2 employees')).toBeInTheDocument()

    // Check employee entries
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('EMP001')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('EMP002')).toBeInTheDocument()
  })

  test('should display summary cards with correct values', () => {
    render(<PayrollSummary payrollData={mockPayrollData} />)

    // Verify summary cards exist
    const summaryCards = screen.getAllByRole('region', { name: /summary/i })
    expect(summaryCards.length).toBeGreaterThan(0)

    // Check specific metrics
    expect(screen.getByText('358h')).toBeInTheDocument() // Total hours
    expect(screen.getByText('179h')).toBeInTheDocument() // Average hours
    expect(screen.getByText('₿8,750')).toBeInTheDocument() // Total deductions
  })

  test('should show employee details in table', () => {
    render(<PayrollSummary payrollData={mockPayrollData} />)

    // Check table headers
    expect(screen.getByText('Employee')).toBeInTheDocument()
    expect(screen.getByText('Hours')).toBeInTheDocument()
    expect(screen.getByText('Gross Salary')).toBeInTheDocument()
    expect(screen.getByText('Deductions')).toBeInTheDocument()
    expect(screen.getByText('Net Salary')).toBeInTheDocument()

    // Check employee data
    expect(screen.getByText('188h')).toBeInTheDocument() // John's total hours (160+20+8)
    expect(screen.getByText('170h')).toBeInTheDocument() // Jane's total hours (160+10+0)
    expect(screen.getByText('₿30,900')).toBeInTheDocument() // John's gross
    expect(screen.getByText('₿26,250')).toBeInTheDocument() // Jane's gross
  })

  test('should handle finalize payroll action', async () => {
    const user = userEvent.setup()

    render(<PayrollSummary payrollData={mockPayrollData} />)

    const finalizeButton = screen.getByText('Finalize Payroll')
    await user.click(finalizeButton)

    // Should show confirmation dialog
    expect(screen.getByText('Confirm Payroll Finalization')).toBeInTheDocument()
    expect(screen.getByText('This action cannot be undone')).toBeInTheDocument()

    const confirmButton = screen.getByText('Yes, Finalize')
    await user.click(confirmButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/payroll/periods/period-123',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'finalized' }),
        })
      )
    })
  })

  test('should handle export payroll action', async () => {
    const user = userEvent.setup()

    // Mock successful export response
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob(['payroll data'], { type: 'application/json' })),
    })

    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = jest.fn()

    render(<PayrollSummary payrollData={mockPayrollData} />)

    const exportButton = screen.getByText('Export')
    await user.click(exportButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/payroll/periods/period-123/export')
    })

    expect(global.URL.createObjectURL).toHaveBeenCalled()
    expect(global.URL.revokeObjectURL).toHaveBeenCalled()
  })

  test('should show breakdown details on expand', async () => {
    const user = userEvent.setup()

    render(<PayrollSummary payrollData={mockPayrollData} />)

    // Find and click expand button for first employee
    const expandButtons = screen.getAllByLabelText('View details')
    await user.click(expandButtons[0])

    // Should show detailed breakdown
    expect(screen.getByText('Regular Hours:')).toBeInTheDocument()
    expect(screen.getByText('160h')).toBeInTheDocument()
    expect(screen.getByText('Overtime Hours:')).toBeInTheDocument()
    expect(screen.getByText('20h')).toBeInTheDocument()
    expect(screen.getByText('Holiday Hours:')).toBeInTheDocument()
    expect(screen.getByText('8h')).toBeInTheDocument()

    // Should show deductions breakdown
    expect(screen.getByText('Social Security:')).toBeInTheDocument()
    expect(screen.getByText('₿750')).toBeInTheDocument()
    expect(screen.getByText('Tax:')).toBeInTheDocument()
    expect(screen.getByText('₿1,500')).toBeInTheDocument()
    expect(screen.getByText('Salary Advances:')).toBeInTheDocument()
    expect(screen.getByText('₿3,000')).toBeInTheDocument()
  })

  test('should filter employees by search', async () => {
    const user = userEvent.setup()

    render(<PayrollSummary payrollData={mockPayrollData} />)

    const searchInput = screen.getByPlaceholderText('Search employees...')
    await user.type(searchInput, 'John')

    // Should show only John Doe
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
  })

  test('should sort employees by different columns', async () => {
    const user = userEvent.setup()

    render(<PayrollSummary payrollData={mockPayrollData} />)

    // Click on gross salary header to sort
    const grossSalaryHeader = screen.getByText('Gross Salary')
    await user.click(grossSalaryHeader)

    // Verify sorting indicator appears
    expect(screen.getByRole('button', { name: /sort/i })).toBeInTheDocument()
  })

  test('should handle different payroll statuses', () => {
    const finalizedPayroll = {
      ...mockPayrollData,
      period: {
        ...mockPayrollData.period,
        status: 'finalized',
      },
    }

    render(<PayrollSummary payrollData={finalizedPayroll} />)

    // Finalize button should be disabled
    expect(screen.getByText('Finalized')).toBeInTheDocument()
    expect(screen.getByText('Finalize Payroll')).toBeDisabled()

    // Should show finalized badge
    expect(screen.getByText('Finalized')).toHaveClass('bg-green-100')
  })

  test('should show error state when no data', () => {
    const emptyPayroll = {
      ...mockPayrollData,
      entries: [],
      totals: {
        ...mockPayrollData.totals,
        total_employees: 0,
        total_gross: 0,
        total_net: 0,
      },
    }

    render(<PayrollSummary payrollData={emptyPayroll} />)

    expect(screen.getByText('No payroll entries found')).toBeInTheDocument()
    expect(screen.getByText('Generate payroll entries first')).toBeInTheDocument()
  })

  test('should handle API errors gracefully', async () => {
    const user = userEvent.setup()

    // Mock API error
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Failed to finalize payroll',
      }),
    })

    render(<PayrollSummary payrollData={mockPayrollData} />)

    const finalizeButton = screen.getByText('Finalize Payroll')
    await user.click(finalizeButton)

    const confirmButton = screen.getByText('Yes, Finalize')
    await user.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText('Failed to finalize payroll')).toBeInTheDocument()
    })
  })

  test('should calculate and display overtime correctly', () => {
    render(<PayrollSummary payrollData={mockPayrollData} />)

    // Check overtime display for employees
    const overtimeElements = screen.getAllByText(/OT:/)
    expect(overtimeElements).toHaveLength(2) // One for each employee

    // John should have 20h overtime
    expect(screen.getByText('OT: 20h')).toBeInTheDocument()
    // Jane should have 10h overtime
    expect(screen.getByText('OT: 10h')).toBeInTheDocument()
  })

  test('should show loading state', () => {
    render(<PayrollSummary payrollData={null} loading={true} />)

    expect(screen.getByText('Loading payroll data...')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  test('should display period status badge correctly', () => {
    render(<PayrollSummary payrollData={mockPayrollData} />)

    const statusBadge = screen.getByText('Draft')
    expect(statusBadge).toBeInTheDocument()
    expect(statusBadge).toHaveClass('bg-yellow-100')
  })

  test('should handle payslip generation', async () => {
    const user = userEvent.setup()

    render(<PayrollSummary payrollData={mockPayrollData} />)

    // Find generate payslips button
    const generateButton = screen.getByText('Generate Payslips')
    await user.click(generateButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/payroll/payslips',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            payroll_period_id: 'period-123',
          }),
        })
      )
    })
  })
})