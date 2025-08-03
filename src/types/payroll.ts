export type PayrollStatus = 'draft' | 'processing' | 'completed' | 'error';

export interface PayrollPeriod {
  id: string;
  branch_id: string;
  start_date: string;
  end_date: string;
  status: PayrollStatus;
  processed_by?: string;
  processed_at?: string;
  created_at: string;
}

export interface PayrollRecord {
  id: string;
  payroll_period_id: string;
  employee_id: string;
  regular_hours: number;
  overtime_hours: number;
  gross_pay: number;
  advance_deductions: number;
  net_pay: number;
  payslip_sent_at?: string;
  created_at: string;
}

export interface PayrollCalculation {
  employee_id: string;
  employee_name: string;
  hourly_rate: number;
  regular_hours: number;
  overtime_hours: number;
  gross_pay: number;
  advance_deductions: number;
  tax_deductions: number;
  net_pay: number;
  time_entries: TimeEntryForPayroll[];
}

export interface TimeEntryForPayroll {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  hours_worked: number;
  is_overtime: boolean;
}

export interface PayslipData {
  employee_name: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  regular_hours: number;
  overtime_hours: number;
  hourly_rate: number;
  overtime_rate: number;
  gross_pay: number;
  advance_deductions: number;
  tax_deductions: number;
  net_pay: number;
  company_name: string;
  company_address: string;
  payslip_date: string;
}

export interface PayrollSummary {
  total_employees: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_gross_pay: number;
  total_deductions: number;
  total_net_pay: number;
  branch_name: string;
  period_start: string;
  period_end: string;
}