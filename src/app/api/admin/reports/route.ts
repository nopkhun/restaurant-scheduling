import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { z } from 'zod';

const reportParamsSchema = z.object({
  type: z.enum(['overview', 'attendance', 'payroll', 'leave', 'performance']),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  branch_id: z.string().uuid().optional(),
  employee_id: z.string().uuid().optional(),
  granularity: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
});

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

    // Check permissions - only admins, HR, and accounting can access reports
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

    if (!['admin', 'hr', 'accounting'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to access reports' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const validationResult = reportParamsSchema.safeParse({
      type: searchParams.get('type'),
      start_date: searchParams.get('start_date'),
      end_date: searchParams.get('end_date'),
      branch_id: searchParams.get('branch_id'),
      employee_id: searchParams.get('employee_id'),
      granularity: searchParams.get('granularity') || 'monthly',
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid parameters', 
          details: validationResult.error.issues 
        }, 
        { status: 400 }
      );
    }

    const params = validationResult.data;
    
    // Set default date range if not provided (last 30 days)
    const endDate = params.end_date ? new Date(params.end_date) : new Date();
    const startDate = params.start_date ? new Date(params.start_date) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    let reportData: any = {};

    switch (params.type) {
      case 'overview':
        reportData = await generateOverviewReport(supabase, startDate, endDate, params);
        break;
      case 'attendance':
        reportData = await generateAttendanceReport(supabase, startDate, endDate, params);
        break;
      case 'payroll':
        reportData = await generatePayrollReport(supabase, startDate, endDate, params);
        break;
      case 'leave':
        reportData = await generateLeaveReport(supabase, startDate, endDate, params);
        break;
      case 'performance':
        reportData = await generatePerformanceReport(supabase, startDate, endDate, params);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      report: {
        type: params.type,
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
        generated_at: new Date().toISOString(),
        ...reportData,
      },
    });

  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function generateOverviewReport(supabase: any, startDate: Date, endDate: Date, params: any) {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Build base filters
  let branchFilter = '';
  if (params.branch_id) {
    branchFilter = `AND branch_id = '${params.branch_id}'`;
  }

  // Get basic statistics
  const [
    { count: totalEmployees },
    { count: activeEmployees },
    { count: totalSchedules },
    { count: completedSchedules },
    { count: totalLeaveRequests },
    { count: pendingLeaveRequests },
    totalPayroll
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .neq('role', 'admin'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .neq('role', 'admin'),
    supabase
      .from('schedules')
      .select('id', { count: 'exact', head: true })
      .gte('shift_date', startDateStr)
      .lte('shift_date', endDateStr),
    supabase
      .from('schedules')
      .select('id', { count: 'exact', head: true })
      .gte('shift_date', startDateStr)
      .lte('shift_date', endDateStr)
      .eq('status', 'completed'),
    supabase
      .from('leave_requests')
      .select('id', { count: 'exact', head: true })
      .gte('start_date', startDateStr)
      .lte('end_date', endDateStr),
    supabase
      .from('leave_requests')
      .select('id', { count: 'exact', head: true })
      .gte('start_date', startDateStr)
      .lte('end_date', endDateStr)
      .eq('status', 'pending'),
    supabase
      .from('payroll_entries')
      .select('gross_salary, net_salary')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
  ]);

  // Calculate payroll totals
  const payrollTotals = totalPayroll.data?.reduce(
    (acc, entry) => ({
      gross: acc.gross + (entry.gross_salary || 0),
      net: acc.net + (entry.net_salary || 0),
    }),
    { gross: 0, net: 0 }
  ) || { gross: 0, net: 0 };

  // Get employee distribution by role
  const { data: roleDistribution } = await supabase
    .from('profiles')
    .select('role')
    .neq('role', 'admin');

  const roleStats = roleDistribution?.reduce((acc: any, profile: any) => {
    acc[profile.role] = (acc[profile.role] || 0) + 1;
    return acc;
  }, {}) || {};

  // Get monthly trends for schedules
  const { data: monthlySchedules } = await supabase
    .from('schedules')
    .select('shift_date, status')
    .gte('shift_date', startDateStr)
    .lte('shift_date', endDateStr)
    .order('shift_date');

  const monthlyTrends = monthlySchedules?.reduce((acc: any, schedule: any) => {
    const month = schedule.shift_date.substring(0, 7); // YYYY-MM
    if (!acc[month]) {
      acc[month] = { total: 0, completed: 0 };
    }
    acc[month].total++;
    if (schedule.status === 'completed') {
      acc[month].completed++;
    }
    return acc;
  }, {}) || {};

  return {
    summary: {
      totalEmployees: totalEmployees || 0,
      activeEmployees: activeEmployees || 0,
      employeeUtilization: totalEmployees ? ((activeEmployees || 0) / totalEmployees * 100).toFixed(1) : '0',
      totalSchedules: totalSchedules || 0,
      completedSchedules: completedSchedules || 0,
      scheduleCompletionRate: totalSchedules ? ((completedSchedules || 0) / totalSchedules * 100).toFixed(1) : '0',
      totalLeaveRequests: totalLeaveRequests || 0,
      pendingLeaveRequests: pendingLeaveRequests || 0,
      payrollTotals,
    },
    roleDistribution: roleStats,
    monthlyTrends,
  };
}

async function generateAttendanceReport(supabase: any, startDate: Date, endDate: Date, params: any) {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get time entries with employee details
  let query = supabase
    .from('time_entries')
    .select(`
      id,
      clock_in_time,
      clock_out_time,
      total_hours,
      status,
      employee:profiles!time_entries_employee_id_fkey(
        id,
        full_name,
        employee_id
      )
    `)
    .gte('clock_in_time', startDate.toISOString())
    .lte('clock_in_time', endDate.toISOString());

  if (params.employee_id) {
    query = query.eq('employee_id', params.employee_id);
  }

  const { data: timeEntries } = await query;

  // Calculate attendance statistics
  const attendanceStats = timeEntries?.reduce((acc: any, entry: any) => {
    const employeeId = entry.employee.id;
    if (!acc[employeeId]) {
      acc[employeeId] = {
        employee: entry.employee,
        totalHours: 0,
        totalDays: 0,
        onTimeDays: 0,
        lateDays: 0,
        absentDays: 0,
      };
    }

    acc[employeeId].totalHours += entry.total_hours || 0;
    acc[employeeId].totalDays++;

    // Determine if late (simple logic - can be enhanced)
    if (entry.clock_in_time) {
      const clockInTime = new Date(entry.clock_in_time);
      const clockInHour = clockInTime.getHours();
      if (clockInHour > 9) { // Assuming 9 AM is the standard start time
        acc[employeeId].lateDays++;
      } else {
        acc[employeeId].onTimeDays++;
      }
    }

    return acc;
  }, {}) || {};

  // Convert to array and calculate percentages
  const attendanceData = Object.values(attendanceStats).map((stats: any) => ({
    ...stats,
    averageHoursPerDay: stats.totalDays ? (stats.totalHours / stats.totalDays).toFixed(1) : '0',
    onTimePercentage: stats.totalDays ? ((stats.onTimeDays / stats.totalDays) * 100).toFixed(1) : '0',
    latePercentage: stats.totalDays ? ((stats.lateDays / stats.totalDays) * 100).toFixed(1) : '0',
  }));

  // Get daily attendance trends
  const dailyTrends = timeEntries?.reduce((acc: any, entry: any) => {
    const date = entry.clock_in_time.split('T')[0];
    if (!acc[date]) {
      acc[date] = { total: 0, onTime: 0, late: 0 };
    }
    acc[date].total++;
    
    const clockInTime = new Date(entry.clock_in_time);
    const clockInHour = clockInTime.getHours();
    if (clockInHour > 9) {
      acc[date].late++;
    } else {
      acc[date].onTime++;
    }
    
    return acc;
  }, {}) || {};

  return {
    attendanceData,
    dailyTrends,
    summary: {
      totalEmployeesTracked: Object.keys(attendanceStats).length,
      averageHoursPerEmployee: attendanceData.length ? 
        (attendanceData.reduce((sum: number, emp: any) => sum + parseFloat(emp.averageHoursPerDay), 0) / attendanceData.length).toFixed(1) : '0',
      overallOnTimeRate: attendanceData.length ?
        (attendanceData.reduce((sum: number, emp: any) => sum + parseFloat(emp.onTimePercentage), 0) / attendanceData.length).toFixed(1) : '0',
    },
  };
}

async function generatePayrollReport(supabase: any, startDate: Date, endDate: Date, params: any) {
  // Get payroll entries with employee details
  let query = supabase
    .from('payroll_entries')
    .select(`
      id,
      gross_salary,
      net_salary,
      regular_hours,
      overtime_hours,
      holiday_hours,
      social_security,
      tax_deduction,
      salary_advances,
      created_at,
      employee:profiles!payroll_entries_employee_id_fkey(
        id,
        full_name,
        employee_id,
        role
      ),
      payroll_period:payroll_periods!payroll_entries_payroll_period_id_fkey(
        period_start,
        period_end
      )
    `)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (params.employee_id) {
    query = query.eq('employee_id', params.employee_id);
  }

  const { data: payrollEntries } = await query;

  // Calculate totals and averages
  const totals = payrollEntries?.reduce((acc: any, entry: any) => ({
    grossSalary: acc.grossSalary + (entry.gross_salary || 0),
    netSalary: acc.netSalary + (entry.net_salary || 0),
    regularHours: acc.regularHours + (entry.regular_hours || 0),
    overtimeHours: acc.overtimeHours + (entry.overtime_hours || 0),
    holidayHours: acc.holidayHours + (entry.holiday_hours || 0),
    socialSecurity: acc.socialSecurity + (entry.social_security || 0),
    taxDeduction: acc.taxDeduction + (entry.tax_deduction || 0),
    salaryAdvances: acc.salaryAdvances + (entry.salary_advances || 0),
  }), {
    grossSalary: 0,
    netSalary: 0,
    regularHours: 0,
    overtimeHours: 0,
    holidayHours: 0,
    socialSecurity: 0,
    taxDeduction: 0,
    salaryAdvances: 0,
  }) || {};

  // Group by employee
  const employeePayroll = payrollEntries?.reduce((acc: any, entry: any) => {
    const employeeId = entry.employee.id;
    if (!acc[employeeId]) {
      acc[employeeId] = {
        employee: entry.employee,
        totalGross: 0,
        totalNet: 0,
        totalHours: 0,
        entryCount: 0,
      };
    }

    acc[employeeId].totalGross += entry.gross_salary || 0;
    acc[employeeId].totalNet += entry.net_salary || 0;
    acc[employeeId].totalHours += (entry.regular_hours || 0) + (entry.overtime_hours || 0) + (entry.holiday_hours || 0);
    acc[employeeId].entryCount++;

    return acc;
  }, {}) || {};

  // Convert to array with averages
  const employeeData = Object.values(employeePayroll).map((emp: any) => ({
    ...emp,
    averageGross: emp.entryCount ? (emp.totalGross / emp.entryCount).toFixed(2) : '0',
    averageNet: emp.entryCount ? (emp.totalNet / emp.entryCount).toFixed(2) : '0',
    averageHours: emp.entryCount ? (emp.totalHours / emp.entryCount).toFixed(1) : '0',
  }));

  // Monthly trends
  const monthlyTrends = payrollEntries?.reduce((acc: any, entry: any) => {
    const month = entry.created_at.substring(0, 7); // YYYY-MM
    if (!acc[month]) {
      acc[month] = { grossSalary: 0, netSalary: 0, employeeCount: 0 };
    }
    acc[month].grossSalary += entry.gross_salary || 0;
    acc[month].netSalary += entry.net_salary || 0;
    acc[month].employeeCount++;
    return acc;
  }, {}) || {};

  return {
    totals,
    employeeData,
    monthlyTrends,
    summary: {
      totalEntries: payrollEntries?.length || 0,
      averageGrossSalary: payrollEntries?.length ? (totals.grossSalary / payrollEntries.length).toFixed(2) : '0',
      averageNetSalary: payrollEntries?.length ? (totals.netSalary / payrollEntries.length).toFixed(2) : '0',
      totalHours: totals.regularHours + totals.overtimeHours + totals.holidayHours,
      overtimePercentage: (totals.regularHours + totals.overtimeHours) ? 
        ((totals.overtimeHours / (totals.regularHours + totals.overtimeHours)) * 100).toFixed(1) : '0',
    },
  };
}

async function generateLeaveReport(supabase: any, startDate: Date, endDate: Date, params: any) {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get leave requests with employee details
  let query = supabase
    .from('leave_requests')
    .select(`
      id,
      leave_type,
      start_date,
      end_date,
      total_days,
      status,
      created_at,
      employee:profiles!leave_requests_employee_id_fkey(
        id,
        full_name,
        employee_id
      )
    `)
    .gte('start_date', startDateStr)
    .lte('end_date', endDateStr);

  if (params.employee_id) {
    query = query.eq('employee_id', params.employee_id);
  }

  const { data: leaveRequests } = await query;

  // Group by leave type
  const leaveTypeStats = leaveRequests?.reduce((acc: any, request: any) => {
    const type = request.leave_type;
    if (!acc[type]) {
      acc[type] = { total: 0, approved: 0, pending: 0, rejected: 0, totalDays: 0 };
    }
    acc[type].total++;
    acc[type][request.status]++;
    if (request.status === 'approved') {
      acc[type].totalDays += request.total_days || 0;
    }
    return acc;
  }, {}) || {};

  // Group by employee
  const employeeLeave = leaveRequests?.reduce((acc: any, request: any) => {
    const employeeId = request.employee.id;
    if (!acc[employeeId]) {
      acc[employeeId] = {
        employee: request.employee,
        totalRequests: 0,
        approvedRequests: 0,
        totalDaysTaken: 0,
        leaveTypes: {},
      };
    }

    acc[employeeId].totalRequests++;
    if (request.status === 'approved') {
      acc[employeeId].approvedRequests++;
      acc[employeeId].totalDaysTaken += request.total_days || 0;
    }

    const type = request.leave_type;
    if (!acc[employeeId].leaveTypes[type]) {
      acc[employeeId].leaveTypes[type] = 0;
    }
    if (request.status === 'approved') {
      acc[employeeId].leaveTypes[type] += request.total_days || 0;
    }

    return acc;
  }, {}) || {};

  // Convert to array with calculated fields
  const employeeData = Object.values(employeeLeave).map((emp: any) => ({
    ...emp,
    approvalRate: emp.totalRequests ? ((emp.approvedRequests / emp.totalRequests) * 100).toFixed(1) : '0',
  }));

  // Monthly trends
  const monthlyTrends = leaveRequests?.reduce((acc: any, request: any) => {
    const month = request.created_at.substring(0, 7); // YYYY-MM
    if (!acc[month]) {
      acc[month] = { total: 0, approved: 0, pending: 0, rejected: 0 };
    }
    acc[month].total++;
    acc[month][request.status]++;
    return acc;
  }, {}) || {};

  return {
    leaveTypeStats,
    employeeData,
    monthlyTrends,
    summary: {
      totalRequests: leaveRequests?.length || 0,
      approvedRequests: leaveRequests?.filter(r => r.status === 'approved').length || 0,
      pendingRequests: leaveRequests?.filter(r => r.status === 'pending').length || 0,
      rejectedRequests: leaveRequests?.filter(r => r.status === 'rejected').length || 0,
      totalDaysTaken: leaveRequests?.filter(r => r.status === 'approved').reduce((sum, r) => sum + (r.total_days || 0), 0) || 0,
      approvalRate: leaveRequests?.length ? 
        ((leaveRequests.filter(r => r.status === 'approved').length / leaveRequests.length) * 100).toFixed(1) : '0',
    },
  };
}

async function generatePerformanceReport(supabase: any, startDate: Date, endDate: Date, params: any) {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get schedules and time entries for performance metrics
  let scheduleQuery = supabase
    .from('schedules')
    .select(`
      id,
      shift_date,
      start_time,
      end_time,
      status,
      employee:profiles!schedules_employee_id_fkey(
        id,
        full_name,
        employee_id
      )
    `)
    .gte('shift_date', startDateStr)
    .lte('shift_date', endDateStr);

  if (params.employee_id) {
    scheduleQuery = scheduleQuery.eq('employee_id', params.employee_id);
  }

  const { data: schedules } = await scheduleQuery;

  // Calculate performance metrics by employee
  const employeePerformance = schedules?.reduce((acc: any, schedule: any) => {
    const employeeId = schedule.employee.id;
    if (!acc[employeeId]) {
      acc[employeeId] = {
        employee: schedule.employee,
        totalScheduled: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
      };
    }

    acc[employeeId].totalScheduled++;
    acc[employeeId][schedule.status]++;

    return acc;
  }, {}) || {};

  // Convert to array with calculated metrics
  const performanceData = Object.values(employeePerformance).map((emp: any) => ({
    ...emp,
    completionRate: emp.totalScheduled ? ((emp.completed / emp.totalScheduled) * 100).toFixed(1) : '0',
    reliabilityScore: emp.totalScheduled ? 
      (((emp.completed + emp.cancelled * 0.5) / emp.totalScheduled) * 100).toFixed(1) : '0',
  }));

  // Department performance (if branches are treated as departments)
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name');

  const departmentPerformance = await Promise.all(
    (branches || []).map(async (branch: any) => {
      const { data: branchSchedules } = await supabase
        .from('schedules')
        .select('status, employee:profiles!schedules_employee_id_fkey(branch_id)')
        .gte('shift_date', startDateStr)
        .lte('shift_date', endDateStr)
        .eq('profiles.branch_id', branch.id);

      const stats = branchSchedules?.reduce((acc: any, schedule: any) => {
        acc.total++;
        acc[schedule.status]++;
        return acc;
      }, { total: 0, completed: 0, cancelled: 0, pending: 0, no_show: 0 }) || 
      { total: 0, completed: 0, cancelled: 0, pending: 0, no_show: 0 };

      return {
        branch: branch.name,
        ...stats,
        completionRate: stats.total ? ((stats.completed / stats.total) * 100).toFixed(1) : '0',
      };
    })
  );

  return {
    employeePerformance: performanceData,
    departmentPerformance,
    summary: {
      totalSchedules: schedules?.length || 0,
      completedSchedules: schedules?.filter(s => s.status === 'completed').length || 0,
      cancelledSchedules: schedules?.filter(s => s.status === 'cancelled').length || 0,
      noShowSchedules: schedules?.filter(s => s.status === 'no_show').length || 0,
      overallCompletionRate: schedules?.length ? 
        ((schedules.filter(s => s.status === 'completed').length / schedules.length) * 100).toFixed(1) : '0',
    },
  };
}