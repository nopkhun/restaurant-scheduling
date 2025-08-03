import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { PayslipGenerator } from '@/lib/payroll/payslip-generator';
import { getPayslipNotificationService, PayslipNotificationData } from '@/lib/google-chat/payslip-notifications';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    
    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id');
    const periodId = searchParams.get('period_id');
    const year = searchParams.get('year');
    const status = searchParams.get('status');

    // Build query based on user role
    let query = supabase
      .from('payslips')
      .select(`
        *,
        payroll_entry:payroll_entries!payroll_entry_id (
          *,
          employee:profiles!employee_id (
            full_name,
            employee_id
          )
        ),
        payroll_period:payroll_periods!payroll_period_id (
          period_start,
          period_end,
          pay_date
        )
      `)
      .order('created_at', { ascending: false });

    // For employees, only show their own payslips
    if (profile.role === 'employee') {
      query = query.eq('employee_id', profile.id);
    } else {
      // For HR/accounting/admin, allow filtering by employee
      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }
    }

    // Apply other filters
    if (periodId) {
      query = query.eq('payroll_period_id', periodId);
    }

    if (year) {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      // This would require a join or subquery in a real implementation
      // For now, we'll filter on the issued_date
      query = query.gte('issued_date', yearStart).lte('issued_date', yearEnd);
    }

    const { data: payslips, error: payslipsError } = await query;

    if (payslipsError) {
      console.error('Error fetching payslips:', payslipsError);
      return NextResponse.json(
        { error: 'Failed to fetch payslips' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      payslips: payslips || [],
    });

  } catch (error) {
    console.error('Error in payslips API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    
    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permissions - only HR, accounting, and admins can generate payslips
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (!['hr', 'accounting', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to generate payslips' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { payrollEntryIds, periodId, sendToEmployees = false } = body;

    if (!payrollEntryIds || !Array.isArray(payrollEntryIds) || payrollEntryIds.length === 0) {
      return NextResponse.json(
        { error: 'Payroll entry IDs are required' },
        { status: 400 }
      );
    }

    const generatedPayslips = [];
    const errors = [];
    const notificationsToSend: PayslipNotificationData[] = [];

    for (const entryId of payrollEntryIds) {
      try {
        // Get payroll entry with employee and period data
        const { data: entry, error: entryError } = await supabase
          .from('payroll_entries')
          .select(`
            *,
            employee:profiles!employee_id (
              id,
              full_name,
              employee_id,
              email,
              hire_date,
              hourly_rate
            ),
            payroll_period:payroll_periods!payroll_period_id (
              *
            )
          `)
          .eq('id', entryId)
          .single();

        if (entryError || !entry) {
          errors.push(`Payroll entry ${entryId} not found`);
          continue;
        }

        // Check if payslip already exists
        const { data: existingPayslip } = await supabase
          .from('payslips')
          .select('id')
          .eq('payroll_entry_id', entryId)
          .single();

        if (existingPayslip) {
          errors.push(`Payslip already exists for entry ${entryId}`);
          continue;
        }

        // Prepare payslip data
        const hoursBreakdown = {
          regularHours: entry.regular_hours,
          overtimeHours: entry.overtime_hours,
          holidayHours: entry.holiday_hours,
          totalHours: entry.regular_hours + entry.overtime_hours + entry.holiday_hours,
        };

        const calculation = {
          regularHours: entry.regular_hours,
          overtimeHours: entry.overtime_hours,
          holidayHours: entry.holiday_hours,
          regularPay: entry.regular_hours * entry.regular_rate,
          overtimePay: entry.overtime_hours * entry.overtime_rate,
          holidayPay: entry.holiday_hours * entry.holiday_rate,
          grossSalary: entry.gross_salary,
          socialSecurity: entry.social_security,
          taxDeduction: entry.tax_deduction,
          salaryAdvances: entry.salary_advances,
          otherDeductions: entry.other_deductions,
          totalDeductions: entry.social_security + entry.tax_deduction + entry.salary_advances + entry.other_deductions,
          netSalary: entry.net_salary,
          rates: {
            regularRate: entry.regular_rate,
            overtimeRate: entry.overtime_rate,
            holidayRate: entry.holiday_rate,
          },
        };

        const payslipData = PayslipGenerator.preparePayslipData(
          entry.employee,
          entry.payroll_period,
          calculation,
          hoursBreakdown
        );

        // Validate payslip data
        const validationErrors = PayslipGenerator.validatePayslipData(payslipData);
        if (validationErrors.length > 0) {
          errors.push(`Validation failed for entry ${entryId}: ${validationErrors.join(', ')}`);
          continue;
        }

        // Generate HTML content
        const htmlContent = PayslipGenerator.generateHTMLPayslip(payslipData);

        // Create payslip record
        const { data: newPayslip, error: createError } = await supabase
          .from('payslips')
          .insert({
            payroll_entry_id: entryId,
            employee_id: entry.employee_id,
            payroll_period_id: entry.payroll_period_id,
            slip_number: payslipData.slipNumber,
            issued_date: new Date().toISOString().split('T')[0],
            is_sent: false,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating payslip:', createError);
          errors.push(`Failed to create payslip for entry ${entryId}`);
          continue;
        }

        generatedPayslips.push({
          payslip: newPayslip,
          data: payslipData,
          htmlContent,
        });

        // Prepare notification data if sending to employees
        if (sendToEmployees && entry.employee.email) {
          notificationsToSend.push({
            employeeEmail: entry.employee.email,
            employeeName: entry.employee.full_name,
            slipNumber: payslipData.slipNumber,
            periodStart: entry.payroll_period.period_start,
            periodEnd: entry.payroll_period.period_end,
            netSalary: entry.net_salary,
            payslipUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payslips`,
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
          });
        }

      } catch (error) {
        console.error(`Error generating payslip for entry ${entryId}:`, error);
        errors.push(`Unexpected error for entry ${entryId}`);
      }
    }

    // Send Google Chat notifications if requested and notifications are configured
    let notificationResults = null;
    if (sendToEmployees && notificationsToSend.length > 0) {
      try {
        const notificationService = getPayslipNotificationService();
        notificationResults = await notificationService.sendBulkPayslipNotifications(notificationsToSend);
        
        // Send HR summary notification
        if (generatedPayslips.length > 0) {
          const totalAmount = generatedPayslips.reduce((sum, p) => sum + p.data.netSalary, 0);
          const firstPeriod = generatedPayslips[0]?.data.period;
          
          if (firstPeriod) {
            await notificationService.sendHRPayslipSummary({
              payslips: generatedPayslips.map(p => ({
                employeeName: p.data.employee.fullName,
                slipNumber: p.data.slipNumber,
                netSalary: p.data.netSalary,
              })),
              periodStart: firstPeriod.periodStart,
              periodEnd: firstPeriod.periodEnd,
              totalAmount,
              totalEmployees: generatedPayslips.length,
            });
          }
        }
      } catch (error) {
        console.error('Error sending Google Chat notifications:', error);
        errors.push('Failed to send some notifications via Google Chat');
      }
    }

    const responseMessage = notificationResults 
      ? `Generated ${generatedPayslips.length} payslips and sent ${notificationResults.successful} notifications`
      : `Generated ${generatedPayslips.length} payslips`;

    return NextResponse.json({
      message: responseMessage,
      generated: generatedPayslips.length,
      errors: errors.length > 0 ? errors : undefined,
      notifications: notificationResults,
      payslips: generatedPayslips.map(p => ({
        id: p.payslip.id,
        slipNumber: p.data.slipNumber,
        employeeName: p.data.employee.fullName,
        netSalary: p.data.netSalary,
      })),
    }, { status: 201 });

  } catch (error) {
    console.error('Error in payslip generation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}