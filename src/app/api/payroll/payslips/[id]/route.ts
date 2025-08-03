import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { PayslipGenerator } from '@/lib/payroll/payslip-generator';
import { getPayslipNotificationService } from '@/lib/google-chat/payslip-notifications';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Get the payslip with all related data
    const { data: payslip, error: payslipError } = await supabase
      .from('payslips')
      .select(`
        *,
        payroll_entry:payroll_entries!payroll_entry_id (
          *,
          employee:profiles!employee_id (
            id,
            full_name,
            employee_id,
            email,
            hire_date,
            hourly_rate
          )
        ),
        payroll_period:payroll_periods!payroll_period_id (
          *
        )
      `)
      .eq('id', id)
      .single();

    if (payslipError || !payslip) {
      return NextResponse.json(
        { error: 'Payslip not found' },
        { status: 404 }
      );
    }

    // Check permissions - employees can only view their own payslips
    if (profile.role === 'employee' && payslip.employee_id !== profile.id) {
      return NextResponse.json(
        { error: 'You can only view your own payslips' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    // Prepare payslip data for display/export
    const entry = payslip.payroll_entry;
    const period = payslip.payroll_period;

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
      period,
      calculation,
      hoursBreakdown
    );

    // Override with actual payslip data
    payslipData.slipNumber = payslip.slip_number;
    payslipData.issuedDate = payslip.issued_date;

    // Return different formats based on request
    if (format === 'html') {
      const htmlContent = PayslipGenerator.generateHTMLPayslip(payslipData);
      return new NextResponse(htmlContent, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }

    if (format === 'pdf') {
      // TODO: Implement PDF generation using libraries like Puppeteer or jsPDF
      return NextResponse.json(
        { error: 'PDF generation not yet implemented' },
        { status: 501 }
      );
    }

    // Default: return JSON data
    return NextResponse.json({
      payslip: {
        ...payslip,
        data: payslipData,
        summary: PayslipGenerator.formatPayslipSummary(payslipData),
      },
    });

  } catch (error) {
    console.error('Error fetching payslip:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check permissions - only HR, accounting, and admins can update payslips
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
        { error: 'Insufficient permissions to update payslips' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, notes } = body;

    if (!action || !['send', 'resend', 'mark_sent'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be send, resend, or mark_sent' },
        { status: 400 }
      );
    }

    // Get the payslip with related data for notifications
    const { data: payslip, error: fetchError } = await supabase
      .from('payslips')
      .select(`
        *,
        employee:profiles!employee_id(email, full_name),
        payroll_entry:payroll_entries!payroll_entry_id(
          net_salary,
          payroll_period:payroll_periods!payroll_period_id(
            period_start,
            period_end
          )
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !payslip) {
      return NextResponse.json(
        { error: 'Payslip not found' },
        { status: 404 }
      );
    }

    let updateData: any = {};
    let notificationSent = false;

    switch (action) {
      case 'send':
      case 'resend':
        // Send via Google Chat if configured
        if (payslip.employee.email) {
          try {
            const notificationService = getPayslipNotificationService();
            const result = await notificationService.sendPayslipNotification({
              employeeEmail: payslip.employee.email,
              employeeName: payslip.employee.full_name,
              slipNumber: payslip.slip_number,
              periodStart: payslip.payroll_entry.payroll_period.period_start,
              periodEnd: payslip.payroll_entry.payroll_period.period_end,
              netSalary: payslip.payroll_entry.net_salary,
              payslipUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payslips`,
              dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
            });
            notificationSent = result.success;
            if (!result.success) {
              console.warn(`Failed to send notification: ${result.error}`);
            }
          } catch (error) {
            console.error('Error sending Google Chat notification:', error);
          }
        }

        updateData = {
          is_sent: true,
          sent_at: new Date().toISOString(),
        };
        break;

      case 'mark_sent':
        updateData = {
          is_sent: true,
          sent_at: new Date().toISOString(),
        };
        break;
    }

    // Update the payslip
    const { data: updatedPayslip, error: updateError } = await supabase
      .from('payslips')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating payslip:', updateError);
      return NextResponse.json(
        { error: 'Failed to update payslip' },
        { status: 500 }
      );
    }

    const successMessage = action === 'mark_sent' 
      ? 'Payslip marked as sent successfully'
      : notificationSent 
        ? 'Payslip sent successfully via Google Chat'
        : 'Payslip marked as sent (notification delivery failed)';

    return NextResponse.json({
      message: successMessage,
      payslip: updatedPayslip,
      notificationSent,
    });

  } catch (error) {
    console.error('Error updating payslip:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check permissions - only admins can delete payslips
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

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can delete payslips' },
        { status: 403 }
      );
    }

    // Check if payslip has been sent
    const { data: payslip, error: fetchError } = await supabase
      .from('payslips')
      .select('is_sent, slip_number')
      .eq('id', id)
      .single();

    if (fetchError || !payslip) {
      return NextResponse.json(
        { error: 'Payslip not found' },
        { status: 404 }
      );
    }

    if (payslip.is_sent) {
      return NextResponse.json(
        { error: 'Cannot delete payslips that have been sent to employees' },
        { status: 400 }
      );
    }

    // Delete the payslip
    const { error: deleteError } = await supabase
      .from('payslips')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting payslip:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete payslip' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Payslip deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting payslip:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}