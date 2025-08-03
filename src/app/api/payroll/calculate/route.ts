import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { PayrollCalculator, PayrollCalculationInput } from '@/lib/payroll/calculations';
import { format, parseISO, isValid } from 'date-fns';

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

    // Check permissions - only HR, accounting, and admins can calculate payroll
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
        { error: 'Insufficient permissions to calculate payroll' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { employeeId, periodStart, periodEnd, includeAdvances = true } = body;

    // Validate required fields
    if (!employeeId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Missing required fields: employeeId, periodStart, periodEnd' },
        { status: 400 }
      );
    }

    // Validate dates
    const startDate = parseISO(periodStart);
    const endDate = parseISO(periodEnd);

    if (!isValid(startDate) || !isValid(endDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'Period start date must be before end date' },
        { status: 400 }
      );
    }

    // Get employee profile and hourly rate
    const { data: employee, error: employeeError } = await supabase
      .from('profiles')
      .select('id, full_name, employee_id, hourly_rate, role')
      .eq('id', employeeId)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    if (!employee.hourly_rate || employee.hourly_rate <= 0) {
      return NextResponse.json(
        { error: 'Employee hourly rate not set or invalid' },
        { status: 400 }
      );
    }

    // Get time entries for the period
    const { data: timeEntries, error: timeError } = await supabase
      .from('time_entries')
      .select(`
        total_hours,
        clock_in_time,
        schedule_id,
        schedules!inner (
          shift_date,
          notes
        )
      `)
      .eq('employee_id', employeeId)
      .gte('clock_in_time', format(startDate, 'yyyy-MM-dd'))
      .lte('clock_in_time', format(endDate, 'yyyy-MM-dd') + 'T23:59:59')
      .not('total_hours', 'is', null);

    if (timeError) {
      console.error('Error fetching time entries:', timeError);
      return NextResponse.json(
        { error: 'Failed to fetch time entries' },
        { status: 500 }
      );
    }

    // Process time entries to determine holiday hours
    const processedEntries = timeEntries?.map(entry => ({
      total_hours: entry.total_hours || 0,
      shift_date: entry.schedules?.shift_date || '',
      is_holiday: entry.schedules?.notes?.toLowerCase().includes('holiday') || false,
    })) || [];

    // Calculate hours breakdown
    const hoursBreakdown = PayrollCalculator.calculateHoursBreakdown(processedEntries);

    // Get salary advances for the period if requested
    let salaryAdvances = 0;
    if (includeAdvances) {
      const { data: advances, error: advancesError } = await supabase
        .from('salary_advance_requests')
        .select('amount')
        .eq('employee_id', employeeId)
        .eq('status', 'processed')
        .gte('processed_at', format(startDate, 'yyyy-MM-dd'))
        .lte('processed_at', format(endDate, 'yyyy-MM-dd') + 'T23:59:59');

      if (!advancesError && advances) {
        salaryAdvances = advances.reduce((sum, advance) => sum + advance.amount, 0);
      }
    }

    // Prepare calculation input
    const calculationInput: PayrollCalculationInput = {
      employeeId: employee.id,
      regularHours: hoursBreakdown.regularHours,
      overtimeHours: hoursBreakdown.overtimeHours,
      holidayHours: hoursBreakdown.holidayHours,
      hourlyRate: employee.hourly_rate,
      salaryAdvances,
      otherDeductions: 0, // Can be extended later for other deductions
    };

    // Validate input
    const validationErrors = PayrollCalculator.validateInput(calculationInput);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      );
    }

    // Calculate payroll
    const calculation = PayrollCalculator.calculatePayroll(calculationInput);

    // Return calculation result with employee details
    return NextResponse.json({
      employee: {
        id: employee.id,
        fullName: employee.full_name,
        employeeId: employee.employee_id,
        hourlyRate: employee.hourly_rate,
      },
      period: {
        start: periodStart,
        end: periodEnd,
      },
      hoursBreakdown,
      calculation,
      summary: {
        totalHours: hoursBreakdown.totalHours,
        grossSalary: calculation.grossSalary,
        totalDeductions: calculation.totalDeductions,
        netSalary: calculation.netSalary,
      },
    });

  } catch (error) {
    console.error('Error in payroll calculation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    // Check permissions
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
        { error: 'Insufficient permissions to view payroll calculations' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get('period_start');
    const periodEnd = searchParams.get('period_end');

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Missing required parameters: period_start, period_end' },
        { status: 400 }
      );
    }

    // Get all active employees
    const { data: employees, error: employeesError } = await supabase
      .from('profiles')
      .select('id, full_name, employee_id, hourly_rate')
      .eq('role', 'employee')
      .eq('is_active', true)
      .not('hourly_rate', 'is', null);

    if (employeesError) {
      console.error('Error fetching employees:', employeesError);
      return NextResponse.json(
        { error: 'Failed to fetch employees' },
        { status: 500 }
      );
    }

    // Calculate payroll for each employee
    const calculations = [];
    for (const employee of employees || []) {
      try {
        // This is a simplified version - in a real scenario, you'd want to batch these calculations
        const calcResponse = await fetch(`${request.url.split('/api')[0]}/api/payroll/calculate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            employeeId: employee.id,
            periodStart,
            periodEnd,
            includeAdvances: true,
          }),
        });

        if (calcResponse.ok) {
          const calcData = await calcResponse.json();
          calculations.push(calcData);
        }
      } catch (error) {
        console.error(`Error calculating payroll for employee ${employee.id}:`, error);
        // Continue with other employees
      }
    }

    // Calculate summary
    const payrollResults = calculations.map(calc => calc.calculation);
    const summary = PayrollCalculator.calculatePayrollSummary(payrollResults);

    return NextResponse.json({
      period: {
        start: periodStart,
        end: periodEnd,
      },
      calculations,
      summary,
    });

  } catch (error) {
    console.error('Error in payroll calculations list API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}