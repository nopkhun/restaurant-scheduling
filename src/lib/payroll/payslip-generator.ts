/**
 * Payslip generation utilities
 * Handles PDF generation, formatting, and payslip data preparation
 */

import { format, parseISO } from 'date-fns';

export interface PayslipData {
  // Company Information
  company: {
    name: string;
    address: string;
    taxId: string;
    socialSecurityId: string;
  };
  
  // Employee Information
  employee: {
    id: string;
    fullName: string;
    employeeId: string;
    position: string;
    department: string;
    hireDate: string;
    socialSecurityNumber?: string;
    taxId?: string;
  };
  
  // Payroll Period
  period: {
    id: string;
    periodStart: string;
    periodEnd: string;
    payDate: string;
    description: string;
  };
  
  // Hours and Rates
  hours: {
    regularHours: number;
    overtimeHours: number;
    holidayHours: number;
    totalHours: number;
  };
  
  rates: {
    regularRate: number;
    overtimeRate: number;
    holidayRate: number;
  };
  
  // Earnings
  earnings: {
    regularPay: number;
    overtimePay: number;
    holidayPay: number;
    grossSalary: number;
  };
  
  // Deductions
  deductions: {
    socialSecurity: number;
    taxDeduction: number;
    salaryAdvances: number;
    otherDeductions: number;
    totalDeductions: number;
  };
  
  // Net Pay
  netSalary: number;
  
  // Additional Information
  slipNumber: string;
  issuedDate: string;
  notes?: string;
}

export class PayslipGenerator {
  private static readonly COMPANY_INFO = {
    name: 'Restaurant Management System',
    address: '123 Business District, Bangkok, Thailand 10110',
    taxId: '0-1234-56789-01-2',
    socialSecurityId: 'SS-1234567890',
  };

  /**
   * Generate payslip number
   */
  static generateSlipNumber(employeeId: string, periodStart: string): string {
    const period = format(parseISO(periodStart), 'yyyyMM');
    const timestamp = Date.now().toString().slice(-4);
    return `PS-${period}-${employeeId}-${timestamp}`;
  }

  /**
   * Prepare payslip data from payroll calculation
   */
  static preparePayslipData(
    employee: any,
    period: any,
    calculation: any,
    hoursBreakdown: any
  ): PayslipData {
    const slipNumber = this.generateSlipNumber(employee.employee_id || employee.id, period.period_start);
    
    return {
      company: this.COMPANY_INFO,
      employee: {
        id: employee.id,
        fullName: employee.full_name,
        employeeId: employee.employee_id || 'N/A',
        position: employee.position || 'Restaurant Staff',
        department: employee.department || 'Operations',
        hireDate: employee.hire_date || 'N/A',
        socialSecurityNumber: employee.social_security_number,
        taxId: employee.tax_id,
      },
      period: {
        id: period.id,
        periodStart: period.period_start,
        periodEnd: period.period_end,
        payDate: period.pay_date,
        description: `Payroll Period: ${format(parseISO(period.period_start), 'MMM d')} - ${format(parseISO(period.period_end), 'MMM d, yyyy')}`,
      },
      hours: {
        regularHours: hoursBreakdown.regularHours || calculation.regularHours,
        overtimeHours: hoursBreakdown.overtimeHours || calculation.overtimeHours,
        holidayHours: hoursBreakdown.holidayHours || calculation.holidayHours,
        totalHours: hoursBreakdown.totalHours || (calculation.regularHours + calculation.overtimeHours + calculation.holidayHours),
      },
      rates: {
        regularRate: calculation.rates?.regularRate || employee.hourly_rate,
        overtimeRate: calculation.rates?.overtimeRate || (employee.hourly_rate * 1.5),
        holidayRate: calculation.rates?.holidayRate || (employee.hourly_rate * 2.0),
      },
      earnings: {
        regularPay: calculation.regularPay,
        overtimePay: calculation.overtimePay,
        holidayPay: calculation.holidayPay,
        grossSalary: calculation.grossSalary,
      },
      deductions: {
        socialSecurity: calculation.socialSecurity,
        taxDeduction: calculation.taxDeduction,
        salaryAdvances: calculation.salaryAdvances,
        otherDeductions: calculation.otherDeductions,
        totalDeductions: calculation.totalDeductions,
      },
      netSalary: calculation.netSalary,
      slipNumber,
      issuedDate: new Date().toISOString(),
      notes: period.notes,
    };
  }

  /**
   * Generate HTML payslip content
   */
  static generateHTMLPayslip(data: PayslipData): string {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 2,
      }).format(amount);
    };

    const formatDate = (dateString: string) => {
      return format(parseISO(dateString), 'dd/MM/yyyy');
    };

    return `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pay Slip - ${data.slipNumber}</title>
    <style>
        body {
            font-family: 'Sarabun', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        .payslip {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: 600;
        }
        .header p {
            margin: 5px 0;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #667eea;
            border-bottom: 2px solid #667eea;
            padding-bottom: 8px;
            margin-bottom: 15px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .info-label {
            font-weight: 500;
            color: #666;
        }
        .info-value {
            font-weight: 600;
            color: #333;
        }
        .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        .summary-table th,
        .summary-table td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        .summary-table th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #667eea;
        }
        .summary-table .amount {
            text-align: right;
            font-family: 'Courier New', monospace;
            font-weight: 600;
        }
        .total-row {
            background-color: #f8f9fa;
            font-weight: 700;
        }
        .net-pay {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 18px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #667eea;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .slip-number {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.2);
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
        }
        @media print {
            body {
                background-color: white;
                padding: 0;
            }
            .payslip {
                box-shadow: none;
                border-radius: 0;
            }
        }
    </style>
</head>
<body>
    <div class="payslip">
        <div class="header">
            <div class="slip-number">${data.slipNumber}</div>
            <h1>${data.company.name}</h1>
            <p>${data.company.address}</p>
            <p>Tax ID: ${data.company.taxId} | Social Security ID: ${data.company.socialSecurityId}</p>
            <h2 style="margin: 20px 0 10px 0;">PAY SLIP</h2>
            <p>${data.period.description}</p>
        </div>

        <div class="content">
            <!-- Employee Information -->
            <div class="section">
                <div class="section-title">Employee Information</div>
                <div class="info-grid">
                    <div>
                        <div class="info-item">
                            <span class="info-label">Full Name:</span>
                            <span class="info-value">${data.employee.fullName}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Employee ID:</span>
                            <span class="info-value">${data.employee.employeeId}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Position:</span>
                            <span class="info-value">${data.employee.position}</span>
                        </div>
                    </div>
                    <div>
                        <div class="info-item">
                            <span class="info-label">Department:</span>
                            <span class="info-value">${data.employee.department}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Pay Date:</span>
                            <span class="info-value">${formatDate(data.period.payDate)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Pay Period:</span>
                            <span class="info-value">${formatDate(data.period.periodStart)} - ${formatDate(data.period.periodEnd)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Hours and Earnings -->
            <div class="section">
                <div class="section-title">Hours and Earnings</div>
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th style="text-align: center;">Hours</th>
                            <th style="text-align: center;">Rate</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Regular Hours</td>
                            <td style="text-align: center;">${data.hours.regularHours.toFixed(2)}</td>
                            <td style="text-align: center;">${formatCurrency(data.rates.regularRate)}</td>
                            <td class="amount">${formatCurrency(data.earnings.regularPay)}</td>
                        </tr>
                        <tr>
                            <td>Overtime Hours (1.5x)</td>
                            <td style="text-align: center;">${data.hours.overtimeHours.toFixed(2)}</td>
                            <td style="text-align: center;">${formatCurrency(data.rates.overtimeRate)}</td>
                            <td class="amount">${formatCurrency(data.earnings.overtimePay)}</td>
                        </tr>
                        <tr>
                            <td>Holiday Hours (2.0x)</td>
                            <td style="text-align: center;">${data.hours.holidayHours.toFixed(2)}</td>
                            <td style="text-align: center;">${formatCurrency(data.rates.holidayRate)}</td>
                            <td class="amount">${formatCurrency(data.earnings.holidayPay)}</td>
                        </tr>
                        <tr class="total-row">
                            <td><strong>Total</strong></td>
                            <td style="text-align: center;"><strong>${data.hours.totalHours.toFixed(2)}</strong></td>
                            <td style="text-align: center;">-</td>
                            <td class="amount"><strong>${formatCurrency(data.earnings.grossSalary)}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Deductions -->
            <div class="section">
                <div class="section-title">Deductions</div>
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Social Security (5%)</td>
                            <td class="amount">${formatCurrency(data.deductions.socialSecurity)}</td>
                        </tr>
                        <tr>
                            <td>Tax Deduction</td>
                            <td class="amount">${formatCurrency(data.deductions.taxDeduction)}</td>
                        </tr>
                        <tr>
                            <td>Salary Advances</td>
                            <td class="amount">${formatCurrency(data.deductions.salaryAdvances)}</td>
                        </tr>
                        <tr>
                            <td>Other Deductions</td>
                            <td class="amount">${formatCurrency(data.deductions.otherDeductions)}</td>
                        </tr>
                        <tr class="total-row">
                            <td><strong>Total Deductions</strong></td>
                            <td class="amount"><strong>${formatCurrency(data.deductions.totalDeductions)}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Net Pay -->
            <div class="section">
                <table class="summary-table">
                    <tbody>
                        <tr>
                            <td><strong>Gross Salary</strong></td>
                            <td class="amount"><strong>${formatCurrency(data.earnings.grossSalary)}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Total Deductions</strong></td>
                            <td class="amount"><strong>-${formatCurrency(data.deductions.totalDeductions)}</strong></td>
                        </tr>
                        <tr class="net-pay">
                            <td><strong>NET PAY</strong></td>
                            <td class="amount"><strong>${formatCurrency(data.netSalary)}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            ${data.notes ? `
            <div class="section">
                <div class="section-title">Notes</div>
                <p style="padding: 15px; background-color: #f8f9fa; border-radius: 4px; margin: 0;">${data.notes}</p>
            </div>
            ` : ''}

            <div class="footer">
                <p>This payslip is computer generated and does not require a signature.</p>
                <p>Generated on ${formatDate(data.issuedDate)} | Slip Number: ${data.slipNumber}</p>
                <p style="margin-top: 20px; color: #999; font-size: 12px;">
                    For any queries regarding this payslip, please contact the HR department.
                </p>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Validate payslip data
   */
  static validatePayslipData(data: PayslipData): string[] {
    const errors: string[] = [];

    if (!data.employee.fullName) {
      errors.push('Employee full name is required');
    }

    if (!data.employee.employeeId) {
      errors.push('Employee ID is required');
    }

    if (!data.period.periodStart || !data.period.periodEnd) {
      errors.push('Payroll period dates are required');
    }

    if (data.earnings.grossSalary < 0) {
      errors.push('Gross salary cannot be negative');
    }

    if (data.netSalary < 0) {
      errors.push('Net salary cannot be negative');
    }

    if (data.hours.totalHours < 0) {
      errors.push('Total hours cannot be negative');
    }

    return errors;
  }

  /**
   * Format payslip data for display
   */
  static formatPayslipSummary(data: PayslipData): {
    title: string;
    subtitle: string;
    netPay: string;
    grossPay: string;
    totalDeductions: string;
    totalHours: string;
  } {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 0,
      }).format(amount);
    };

    return {
      title: `Payslip for ${data.employee.fullName}`,
      subtitle: `${format(parseISO(data.period.periodStart), 'MMM d')} - ${format(parseISO(data.period.periodEnd), 'MMM d, yyyy')}`,
      netPay: formatCurrency(data.netSalary),
      grossPay: formatCurrency(data.earnings.grossSalary),
      totalDeductions: formatCurrency(data.deductions.totalDeductions),
      totalHours: `${data.hours.totalHours.toFixed(1)} hours`,
    };
  }
}