/**
 * Payroll calculation engine for Thai restaurant business
 * Handles overtime, deductions, tax calculations according to Thai labor law
 */

export interface PayrollCalculationInput {
  employeeId: string;
  regularHours: number;
  overtimeHours: number;
  holidayHours: number;
  hourlyRate: number;
  salaryAdvances: number;
  otherDeductions?: number;
}

export interface PayrollCalculationResult {
  regularHours: number;
  overtimeHours: number;
  holidayHours: number;
  regularPay: number;
  overtimePay: number;
  holidayPay: number;
  grossSalary: number;
  socialSecurity: number;
  taxDeduction: number;
  salaryAdvances: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  rates: {
    regularRate: number;
    overtimeRate: number;
    holidayRate: number;
  };
}

export interface HoursBreakdown {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  holidayHours: number;
}

export class PayrollCalculator {
  // Thai labor law constants
  private static readonly REGULAR_HOURS_PER_DAY = 8;
  private static readonly REGULAR_HOURS_PER_WEEK = 40;
  private static readonly OVERTIME_MULTIPLIER = 1.5;
  private static readonly HOLIDAY_MULTIPLIER = 2.0;
  
  // Thai social security and tax constants
  private static readonly SOCIAL_SECURITY_RATE = 0.05; // 5%
  private static readonly SOCIAL_SECURITY_MAX = 750; // Maximum 750 THB per month
  private static readonly TAX_EXEMPTION = 60000; // Annual exemption 60,000 THB
  
  // Tax brackets (annual)
  private static readonly TAX_BRACKETS = [
    { min: 0, max: 150000, rate: 0.00 },
    { min: 150000, max: 300000, rate: 0.05 },
    { min: 300000, max: 500000, rate: 0.10 },
    { min: 500000, max: 750000, rate: 0.15 },
    { min: 750000, max: 1000000, rate: 0.20 },
    { min: 1000000, max: 2000000, rate: 0.25 },
    { min: 2000000, max: 5000000, rate: 0.30 },
    { min: 5000000, max: Infinity, rate: 0.35 },
  ];

  /**
   * Calculate hours breakdown from time entries
   */
  static calculateHoursBreakdown(
    timeEntries: Array<{
      total_hours: number;
      shift_date: string;
      is_holiday?: boolean;
    }>
  ): HoursBreakdown {
    let totalHours = 0;
    let regularHours = 0;
    let overtimeHours = 0;
    let holidayHours = 0;

    // Group by date to calculate daily overtime
    const dailyHours = new Map<string, { regular: number; total: number; isHoliday: boolean }>();

    timeEntries.forEach(entry => {
      const date = entry.shift_date;
      const hours = entry.total_hours || 0;
      const isHoliday = entry.is_holiday || false;

      if (!dailyHours.has(date)) {
        dailyHours.set(date, { regular: 0, total: 0, isHoliday });
      }

      const dayData = dailyHours.get(date)!;
      dayData.total += hours;
      dayData.isHoliday = dayData.isHoliday || isHoliday;
      dailyHours.set(date, dayData);
    });

    // Calculate overtime and holiday hours
    dailyHours.forEach((dayData) => {
      totalHours += dayData.total;

      if (dayData.isHoliday) {
        // All hours on holidays are paid at holiday rate
        holidayHours += dayData.total;
      } else {
        // Regular day: first 8 hours are regular, rest is overtime
        const dailyRegular = Math.min(dayData.total, this.REGULAR_HOURS_PER_DAY);
        const dailyOvertime = Math.max(0, dayData.total - this.REGULAR_HOURS_PER_DAY);

        regularHours += dailyRegular;
        overtimeHours += dailyOvertime;
      }
    });

    return {
      totalHours,
      regularHours,
      overtimeHours,
      holidayHours,
    };
  }

  /**
   * Calculate social security deduction
   */
  static calculateSocialSecurity(grossSalary: number): number {
    const socialSecurity = grossSalary * this.SOCIAL_SECURITY_RATE;
    return Math.min(socialSecurity, this.SOCIAL_SECURITY_MAX);
  }

  /**
   * Calculate tax deduction using Thai progressive tax rates
   */
  static calculateTaxDeduction(grossSalary: number, socialSecurity: number): number {
    // Annual taxable income (gross - social security - exemption)
    const annualGross = grossSalary * 12;
    const annualSocialSecurity = socialSecurity * 12;
    const taxableIncome = Math.max(0, annualGross - annualSocialSecurity - this.TAX_EXEMPTION);

    let totalTax = 0;
    let remainingIncome = taxableIncome;

    for (const bracket of this.TAX_BRACKETS) {
      if (remainingIncome <= 0) break;

      const bracketAmount = Math.min(remainingIncome, bracket.max - bracket.min);
      totalTax += bracketAmount * bracket.rate;
      remainingIncome -= bracketAmount;
    }

    // Return monthly tax
    return totalTax / 12;
  }

  /**
   * Main payroll calculation function
   */
  static calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
    const {
      regularHours,
      overtimeHours,
      holidayHours,
      hourlyRate,
      salaryAdvances,
      otherDeductions = 0,
    } = input;

    // Calculate rates
    const regularRate = hourlyRate;
    const overtimeRate = hourlyRate * this.OVERTIME_MULTIPLIER;
    const holidayRate = hourlyRate * this.HOLIDAY_MULTIPLIER;

    // Calculate gross pay components
    const regularPay = regularHours * regularRate;
    const overtimePay = overtimeHours * overtimeRate;
    const holidayPay = holidayHours * holidayRate;
    const grossSalary = regularPay + overtimePay + holidayPay;

    // Calculate deductions
    const socialSecurity = this.calculateSocialSecurity(grossSalary);
    const taxDeduction = this.calculateTaxDeduction(grossSalary, socialSecurity);
    const totalDeductions = socialSecurity + taxDeduction + salaryAdvances + otherDeductions;

    // Calculate net salary
    const netSalary = Math.max(0, grossSalary - totalDeductions);

    return {
      regularHours,
      overtimeHours,
      holidayHours,
      regularPay,
      overtimePay,
      holidayPay,
      grossSalary,
      socialSecurity,
      taxDeduction,
      salaryAdvances,
      otherDeductions,
      totalDeductions,
      netSalary,
      rates: {
        regularRate,
        overtimeRate,
        holidayRate,
      },
    };
  }

  /**
   * Validate payroll calculation inputs
   */
  static validateInput(input: PayrollCalculationInput): string[] {
    const errors: string[] = [];

    if (!input.employeeId) {
      errors.push('Employee ID is required');
    }

    if (input.regularHours < 0) {
      errors.push('Regular hours cannot be negative');
    }

    if (input.overtimeHours < 0) {
      errors.push('Overtime hours cannot be negative');
    }

    if (input.holidayHours < 0) {
      errors.push('Holiday hours cannot be negative');
    }

    if (input.hourlyRate <= 0) {
      errors.push('Hourly rate must be greater than 0');
    }

    if (input.salaryAdvances < 0) {
      errors.push('Salary advances cannot be negative');
    }

    if (input.otherDeductions && input.otherDeductions < 0) {
      errors.push('Other deductions cannot be negative');
    }

    // Check for reasonable limits
    const totalHours = input.regularHours + input.overtimeHours + input.holidayHours;
    if (totalHours > 400) { // ~50 hours per week for 8 weeks
      errors.push('Total hours seem unreasonably high');
    }

    if (input.hourlyRate > 10000) { // 10,000 THB per hour is very high
      errors.push('Hourly rate seems unreasonably high');
    }

    return errors;
  }

  /**
   * Format currency for Thai Baht
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Calculate payroll summary for multiple employees
   */
  static calculatePayrollSummary(results: PayrollCalculationResult[]): {
    totalEmployees: number;
    totalGrossSalary: number;
    totalNetSalary: number;
    totalDeductions: number;
    totalSocialSecurity: number;
    totalTax: number;
    totalAdvances: number;
  } {
    return results.reduce(
      (summary, result) => ({
        totalEmployees: summary.totalEmployees + 1,
        totalGrossSalary: summary.totalGrossSalary + result.grossSalary,
        totalNetSalary: summary.totalNetSalary + result.netSalary,
        totalDeductions: summary.totalDeductions + result.totalDeductions,
        totalSocialSecurity: summary.totalSocialSecurity + result.socialSecurity,
        totalTax: summary.totalTax + result.taxDeduction,
        totalAdvances: summary.totalAdvances + result.salaryAdvances,
      }),
      {
        totalEmployees: 0,
        totalGrossSalary: 0,
        totalNetSalary: 0,
        totalDeductions: 0,
        totalSocialSecurity: 0,
        totalTax: 0,
        totalAdvances: 0,
      }
    );
  }
}