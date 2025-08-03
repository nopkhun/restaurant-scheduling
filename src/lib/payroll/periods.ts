/**
 * Payroll period management utilities
 * Handles payroll period creation, validation, and date calculations
 */

import { 
  addDays, 
  addMonths, 
  endOfMonth, 
  format, 
  isAfter, 
  isBefore, 
  isValid, 
  parseISO, 
  startOfMonth,
  subDays,
  addWeeks,
  startOfWeek,
  endOfWeek
} from 'date-fns';

export type PayrollFrequency = 'weekly' | 'bi-weekly' | 'monthly' | 'custom';

export interface PayrollPeriod {
  id?: string;
  periodStart: Date;
  periodEnd: Date;
  cutoffDate: Date;
  payDate: Date;
  frequency: PayrollFrequency;
  description: string;
}

export interface PayrollPeriodInput {
  frequency: PayrollFrequency;
  startDate: Date;
  cutoffDays?: number; // Days before pay date for cutoff
  payDays?: number; // Days after period end for pay date
}

export class PayrollPeriodManager {
  private static readonly DEFAULT_CUTOFF_DAYS = 3;
  private static readonly DEFAULT_PAY_DAYS = 7;

  /**
   * Generate a single payroll period based on frequency and start date
   */
  static generatePeriod(input: PayrollPeriodInput): PayrollPeriod {
    const { frequency, startDate, cutoffDays = this.DEFAULT_CUTOFF_DAYS, payDays = this.DEFAULT_PAY_DAYS } = input;

    let periodStart: Date;
    let periodEnd: Date;
    let description: string;

    switch (frequency) {
      case 'weekly':
        periodStart = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday start
        periodEnd = endOfWeek(startDate, { weekStartsOn: 1 }); // Sunday end
        description = `Weekly (${format(periodStart, 'MMM d')} - ${format(periodEnd, 'MMM d, yyyy')})`;
        break;

      case 'bi-weekly':
        periodStart = startOfWeek(startDate, { weekStartsOn: 1 });
        periodEnd = addDays(endOfWeek(addWeeks(startDate, 1), { weekStartsOn: 1 }), 0);
        description = `Bi-weekly (${format(periodStart, 'MMM d')} - ${format(periodEnd, 'MMM d, yyyy')})`;
        break;

      case 'monthly':
        periodStart = startOfMonth(startDate);
        periodEnd = endOfMonth(startDate);
        description = `Monthly (${format(periodStart, 'MMMM yyyy')})`;
        break;

      case 'custom':
        // For custom periods, use the provided dates as-is
        periodStart = startDate;
        periodEnd = startDate; // This should be provided separately for custom periods
        description = `Custom (${format(periodStart, 'MMM d, yyyy')})`;
        break;

      default:
        throw new Error(`Unsupported payroll frequency: ${frequency}`);
    }

    // Calculate cutoff and pay dates
    const payDate = addDays(periodEnd, payDays);
    const cutoffDate = subDays(payDate, cutoffDays);

    return {
      periodStart,
      periodEnd,
      cutoffDate,
      payDate,
      frequency,
      description,
    };
  }

  /**
   * Generate multiple payroll periods for a given year
   */
  static generatePeriodsForYear(
    year: number,
    frequency: PayrollFrequency,
    cutoffDays: number = this.DEFAULT_CUTOFF_DAYS,
    payDays: number = this.DEFAULT_PAY_DAYS
  ): PayrollPeriod[] {
    const periods: PayrollPeriod[] = [];
    let currentDate = new Date(year, 0, 1); // January 1st

    switch (frequency) {
      case 'weekly':
        // 52-53 weeks per year
        while (currentDate.getFullYear() === year) {
          const period = this.generatePeriod({
            frequency,
            startDate: currentDate,
            cutoffDays,
            payDays,
          });
          periods.push(period);
          currentDate = addWeeks(currentDate, 1);
        }
        break;

      case 'bi-weekly':
        // 26 periods per year
        while (currentDate.getFullYear() === year) {
          const period = this.generatePeriod({
            frequency,
            startDate: currentDate,
            cutoffDays,
            payDays,
          });
          periods.push(period);
          currentDate = addWeeks(currentDate, 2);
        }
        break;

      case 'monthly':
        // 12 months per year
        for (let month = 0; month < 12; month++) {
          const monthStart = new Date(year, month, 1);
          const period = this.generatePeriod({
            frequency,
            startDate: monthStart,
            cutoffDays,
            payDays,
          });
          periods.push(period);
        }
        break;

      default:
        throw new Error(`Cannot generate yearly periods for frequency: ${frequency}`);
    }

    return periods;
  }

  /**
   * Get the current payroll period based on today's date
   */
  static getCurrentPeriod(
    frequency: PayrollFrequency,
    cutoffDays: number = this.DEFAULT_CUTOFF_DAYS,
    payDays: number = this.DEFAULT_PAY_DAYS
  ): PayrollPeriod {
    const today = new Date();
    return this.generatePeriod({
      frequency,
      startDate: today,
      cutoffDays,
      payDays,
    });
  }

  /**
   * Get the next payroll period
   */
  static getNextPeriod(
    currentPeriod: PayrollPeriod,
    cutoffDays: number = this.DEFAULT_CUTOFF_DAYS,
    payDays: number = this.DEFAULT_PAY_DAYS
  ): PayrollPeriod {
    let nextStartDate: Date;

    switch (currentPeriod.frequency) {
      case 'weekly':
        nextStartDate = addWeeks(currentPeriod.periodStart, 1);
        break;
      case 'bi-weekly':
        nextStartDate = addWeeks(currentPeriod.periodStart, 2);
        break;
      case 'monthly':
        nextStartDate = addMonths(currentPeriod.periodStart, 1);
        break;
      default:
        throw new Error(`Cannot calculate next period for frequency: ${currentPeriod.frequency}`);
    }

    return this.generatePeriod({
      frequency: currentPeriod.frequency,
      startDate: nextStartDate,
      cutoffDays,
      payDays,
    });
  }

  /**
   * Get the previous payroll period
   */
  static getPreviousPeriod(
    currentPeriod: PayrollPeriod,
    cutoffDays: number = this.DEFAULT_CUTOFF_DAYS,
    payDays: number = this.DEFAULT_PAY_DAYS
  ): PayrollPeriod {
    let prevStartDate: Date;

    switch (currentPeriod.frequency) {
      case 'weekly':
        prevStartDate = addWeeks(currentPeriod.periodStart, -1);
        break;
      case 'bi-weekly':
        prevStartDate = addWeeks(currentPeriod.periodStart, -2);
        break;
      case 'monthly':
        prevStartDate = addMonths(currentPeriod.periodStart, -1);
        break;
      default:
        throw new Error(`Cannot calculate previous period for frequency: ${currentPeriod.frequency}`);
    }

    return this.generatePeriod({
      frequency: currentPeriod.frequency,
      startDate: prevStartDate,
      cutoffDays,
      payDays,
    });
  }

  /**
   * Validate a payroll period
   */
  static validatePeriod(period: PayrollPeriod): string[] {
    const errors: string[] = [];

    if (!isValid(period.periodStart)) {
      errors.push('Invalid period start date');
    }

    if (!isValid(period.periodEnd)) {
      errors.push('Invalid period end date');
    }

    if (!isValid(period.cutoffDate)) {
      errors.push('Invalid cutoff date');
    }

    if (!isValid(period.payDate)) {
      errors.push('Invalid pay date');
    }

    if (period.periodStart && period.periodEnd && isAfter(period.periodStart, period.periodEnd)) {
      errors.push('Period start date must be before period end date');
    }

    if (period.cutoffDate && period.payDate && isAfter(period.cutoffDate, period.payDate)) {
      errors.push('Cutoff date must be before pay date');
    }

    if (period.periodEnd && period.cutoffDate && isBefore(period.cutoffDate, period.periodEnd)) {
      errors.push('Cutoff date should be after period end date');
    }

    return errors;
  }

  /**
   * Check if a date falls within a payroll period
   */
  static isDateInPeriod(date: Date, period: PayrollPeriod): boolean {
    return (
      (date >= period.periodStart && date <= period.periodEnd) ||
      (format(date, 'yyyy-MM-dd') >= format(period.periodStart, 'yyyy-MM-dd') &&
       format(date, 'yyyy-MM-dd') <= format(period.periodEnd, 'yyyy-MM-dd'))
    );
  }

  /**
   * Find the period that contains a specific date
   */
  static findPeriodForDate(
    date: Date,
    periods: PayrollPeriod[]
  ): PayrollPeriod | null {
    return periods.find(period => this.isDateInPeriod(date, period)) || null;
  }

  /**
   * Generate period identifier for database storage
   */
  static generatePeriodId(period: PayrollPeriod): string {
    const start = format(period.periodStart, 'yyyy-MM-dd');
    const end = format(period.periodEnd, 'yyyy-MM-dd');
    return `${period.frequency}-${start}-${end}`;
  }

  /**
   * Format period for display
   */
  static formatPeriod(period: PayrollPeriod): string {
    return period.description;
  }

  /**
   * Check if payroll can be processed (after cutoff date)
   */
  static canProcessPayroll(period: PayrollPeriod): boolean {
    const now = new Date();
    return isAfter(now, period.cutoffDate) || format(now, 'yyyy-MM-dd') === format(period.cutoffDate, 'yyyy-MM-dd');
  }

  /**
   * Get days until pay date
   */
  static getDaysUntilPayDate(period: PayrollPeriod): number {
    const now = new Date();
    const diffTime = period.payDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get payroll period status
   */
  static getPeriodStatus(period: PayrollPeriod): 'upcoming' | 'active' | 'cutoff' | 'processing' | 'completed' {
    const now = new Date();
    
    if (isBefore(now, period.periodStart)) {
      return 'upcoming';
    } else if (this.isDateInPeriod(now, period)) {
      return 'active';
    } else if (isBefore(now, period.cutoffDate)) {
      return 'cutoff';
    } else if (isBefore(now, period.payDate)) {
      return 'processing';
    } else {
      return 'completed';
    }
  }
}