import { PayrollCalculator, PayrollCalculationInput, PayrollCalculationResult } from '../calculations'

describe('PayrollCalculator', () => {
  describe('calculateHoursBreakdown', () => {
    test('should calculate regular hours correctly', () => {
      const timeEntries = [
        { total_hours: 8, shift_date: '2024-01-01', is_holiday: false },
        { total_hours: 7, shift_date: '2024-01-02', is_holiday: false },
      ]

      const result = PayrollCalculator.calculateHoursBreakdown(timeEntries)

      expect(result.totalHours).toBe(15)
      expect(result.regularHours).toBe(15)
      expect(result.overtimeHours).toBe(0)
      expect(result.holidayHours).toBe(0)
    })

    test('should calculate overtime hours correctly', () => {
      const timeEntries = [
        { total_hours: 10, shift_date: '2024-01-01', is_holiday: false },
        { total_hours: 9, shift_date: '2024-01-02', is_holiday: false },
      ]

      const result = PayrollCalculator.calculateHoursBreakdown(timeEntries)

      expect(result.totalHours).toBe(19)
      expect(result.regularHours).toBe(16) // 8 + 8
      expect(result.overtimeHours).toBe(3) // 2 + 1
      expect(result.holidayHours).toBe(0)
    })

    test('should calculate holiday hours correctly', () => {
      const timeEntries = [
        { total_hours: 8, shift_date: '2024-01-01', is_holiday: true },
        { total_hours: 8, shift_date: '2024-01-02', is_holiday: false },
      ]

      const result = PayrollCalculator.calculateHoursBreakdown(timeEntries)

      expect(result.totalHours).toBe(16)
      expect(result.regularHours).toBe(8)
      expect(result.overtimeHours).toBe(0)
      expect(result.holidayHours).toBe(8)
    })

    test('should handle multiple entries on same date', () => {
      const timeEntries = [
        { total_hours: 4, shift_date: '2024-01-01', is_holiday: false },
        { total_hours: 6, shift_date: '2024-01-01', is_holiday: false },
      ]

      const result = PayrollCalculator.calculateHoursBreakdown(timeEntries)

      expect(result.totalHours).toBe(10)
      expect(result.regularHours).toBe(8)
      expect(result.overtimeHours).toBe(2)
      expect(result.holidayHours).toBe(0)
    })
  })

  describe('calculateSocialSecurity', () => {
    test('should calculate 5% for amounts under max', () => {
      expect(PayrollCalculator.calculateSocialSecurity(10000)).toBe(500)
      expect(PayrollCalculator.calculateSocialSecurity(5000)).toBe(250)
    })

    test('should cap at maximum amount', () => {
      expect(PayrollCalculator.calculateSocialSecurity(20000)).toBe(750)
      expect(PayrollCalculator.calculateSocialSecurity(50000)).toBe(750)
    })

    test('should handle zero and negative amounts', () => {
      expect(PayrollCalculator.calculateSocialSecurity(0)).toBe(0)
      expect(PayrollCalculator.calculateSocialSecurity(-1000)).toBe(0)
    })
  })

  describe('calculateTaxDeduction', () => {
    test('should return 0 for low income', () => {
      // Monthly salary 10,000 = Annual 120,000, below exemption
      expect(PayrollCalculator.calculateTaxDeduction(10000, 500)).toBe(0)
    })

    test('should calculate tax correctly for middle income', () => {
      // Monthly salary 20,000 = Annual 240,000
      // Taxable: 240,000 - 6,000 (SS) - 60,000 (exemption) = 174,000
      // Tax: 150,000 * 0% + 24,000 * 5% = 1,200 annually = 100 monthly
      const result = PayrollCalculator.calculateTaxDeduction(20000, 1000)
      expect(Math.round(result)).toBe(100)
    })

    test('should handle high income tax brackets', () => {
      // Monthly salary 100,000 = Annual 1,200,000
      const result = PayrollCalculator.calculateTaxDeduction(100000, 750)
      expect(result).toBeGreaterThan(10000) // Should be substantial tax
    })
  })

  describe('calculatePayroll', () => {
    const basicInput: PayrollCalculationInput = {
      employeeId: 'emp-123',
      regularHours: 160,
      overtimeHours: 20,
      holidayHours: 8,
      hourlyRate: 150,
      salaryAdvances: 5000,
      otherDeductions: 1000,
    }

    test('should calculate basic payroll correctly', () => {
      const result = PayrollCalculator.calculatePayroll(basicInput)

      expect(result.regularPay).toBe(160 * 150) // 24,000
      expect(result.overtimePay).toBe(20 * 150 * 1.5) // 4,500
      expect(result.holidayPay).toBe(8 * 150 * 2) // 2,400
      expect(result.grossSalary).toBe(30900)
      expect(result.salaryAdvances).toBe(5000)
      expect(result.otherDeductions).toBe(1000)
      expect(result.netSalary).toBeGreaterThan(0)
    })

    test('should calculate rates correctly', () => {
      const result = PayrollCalculator.calculatePayroll(basicInput)

      expect(result.rates.regularRate).toBe(150)
      expect(result.rates.overtimeRate).toBe(225) // 150 * 1.5
      expect(result.rates.holidayRate).toBe(300) // 150 * 2
    })

    test('should handle zero deductions', () => {
      const input: PayrollCalculationInput = {
        ...basicInput,
        salaryAdvances: 0,
        otherDeductions: 0,
      }

      const result = PayrollCalculator.calculatePayroll(input)
      expect(result.salaryAdvances).toBe(0)
      expect(result.otherDeductions).toBe(0)
      expect(result.netSalary).toBeLessThan(result.grossSalary)
    })

    test('should ensure net salary is never negative', () => {
      const input: PayrollCalculationInput = {
        ...basicInput,
        salaryAdvances: 50000, // Very high advance
      }

      const result = PayrollCalculator.calculatePayroll(input)
      expect(result.netSalary).toBe(0)
    })
  })

  describe('validateInput', () => {
    const validInput: PayrollCalculationInput = {
      employeeId: 'emp-123',
      regularHours: 160,
      overtimeHours: 20,
      holidayHours: 8,
      hourlyRate: 150,
      salaryAdvances: 5000,
    }

    test('should pass validation for valid input', () => {
      const errors = PayrollCalculator.validateInput(validInput)
      expect(errors).toHaveLength(0)
    })

    test('should fail validation for missing employee ID', () => {
      const input = { ...validInput, employeeId: '' }
      const errors = PayrollCalculator.validateInput(input)
      expect(errors).toContain('Employee ID is required')
    })

    test('should fail validation for negative hours', () => {
      const input = { ...validInput, regularHours: -10 }
      const errors = PayrollCalculator.validateInput(input)
      expect(errors).toContain('Regular hours cannot be negative')
    })

    test('should fail validation for zero hourly rate', () => {
      const input = { ...validInput, hourlyRate: 0 }
      const errors = PayrollCalculator.validateInput(input)
      expect(errors).toContain('Hourly rate must be greater than 0')
    })

    test('should fail validation for unreasonable values', () => {
      const input = { 
        ...validInput, 
        regularHours: 500, // Too many hours
        hourlyRate: 15000, // Too high rate
      }
      const errors = PayrollCalculator.validateInput(input)
      expect(errors).toContain('Total hours seem unreasonably high')
      expect(errors).toContain('Hourly rate seems unreasonably high')
    })
  })

  describe('formatCurrency', () => {
    test('should format Thai Baht correctly', () => {
      expect(PayrollCalculator.formatCurrency(1000)).toBe('฿1,000.00')
      expect(PayrollCalculator.formatCurrency(1234.56)).toBe('฿1,234.56')
      expect(PayrollCalculator.formatCurrency(0)).toBe('฿0.00')
    })

    test('should handle negative amounts', () => {
      expect(PayrollCalculator.formatCurrency(-500)).toBe('-฿500.00')
    })
  })

  describe('calculatePayrollSummary', () => {
    test('should summarize multiple payroll results', () => {
      const results: PayrollCalculationResult[] = [
        {
          regularHours: 160, overtimeHours: 10, holidayHours: 0,
          regularPay: 24000, overtimePay: 2250, holidayPay: 0,
          grossSalary: 26250, socialSecurity: 750, taxDeduction: 500,
          salaryAdvances: 2000, otherDeductions: 0, totalDeductions: 3250,
          netSalary: 23000, rates: { regularRate: 150, overtimeRate: 225, holidayRate: 300 }
        },
        {
          regularHours: 160, overtimeHours: 20, holidayHours: 8,
          regularPay: 32000, overtimePay: 6000, holidayPay: 3200,
          grossSalary: 41200, socialSecurity: 750, taxDeduction: 1200,
          salaryAdvances: 3000, otherDeductions: 500, totalDeductions: 5450,
          netSalary: 35750, rates: { regularRate: 200, overtimeRate: 300, holidayRate: 400 }
        }
      ]

      const summary = PayrollCalculator.calculatePayrollSummary(results)

      expect(summary.totalEmployees).toBe(2)
      expect(summary.totalGrossSalary).toBe(67450)
      expect(summary.totalNetSalary).toBe(58750)
      expect(summary.totalDeductions).toBe(8700)
      expect(summary.totalSocialSecurity).toBe(1500)
      expect(summary.totalTax).toBe(1700)
      expect(summary.totalAdvances).toBe(5000)
    })

    test('should handle empty results array', () => {
      const summary = PayrollCalculator.calculatePayrollSummary([])

      expect(summary.totalEmployees).toBe(0)
      expect(summary.totalGrossSalary).toBe(0)
      expect(summary.totalNetSalary).toBe(0)
      expect(summary.totalDeductions).toBe(0)
    })
  })
})