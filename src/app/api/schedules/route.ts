import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createScheduleSchema } from '@/lib/validations/schedule';
import { getHRNotificationService } from '@/lib/google-chat/hr-notifications';

// GET /api/schedules - Get schedules with filtering
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    const employeeId = searchParams.get('employee_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const status = searchParams.get('status');

    let query = supabase
      .from('schedules')
      .select(`
        *,
        employee:profiles!schedules_employee_id_fkey(id, full_name, employee_id),
        branch:branches!schedules_branch_id_fkey(id, name),
        creator:profiles!schedules_created_by_fkey(id, full_name)
      `)
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true });

    // Apply filters
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }
    if (startDate) {
      query = query.gte('shift_date', startDate);
    }
    if (endDate) {
      query = query.lte('shift_date', endDate);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: schedules, error } = await query;

    if (error) {
      console.error('Error fetching schedules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch schedules' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// POST /api/schedules - Create new schedule
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = createScheduleSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues 
        }, 
        { status: 400 }
      );
    }

    const scheduleData = validationResult.data;

    // Check for schedule conflicts using database function
    const { data: hasConflict, error: conflictError } = await supabase
      .rpc('check_schedule_conflicts', {
        p_employee_id: scheduleData.employee_id,
        p_shift_date: scheduleData.shift_date,
        p_start_time: scheduleData.start_time,
        p_end_time: scheduleData.end_time
      });

    if (conflictError) {
      console.error('Error checking conflicts:', conflictError);
      return NextResponse.json(
        { error: 'Failed to validate schedule' }, 
        { status: 500 }
      );
    }

    if (hasConflict) {
      return NextResponse.json(
        { error: 'Schedule conflict detected. Employee already has a shift at this time.' }, 
        { status: 409 }
      );
    }

    // Create the schedule
    const { data: schedule, error } = await supabase
      .from('schedules')
      .insert({
        ...scheduleData,
        created_by: user.id,
      })
      .select(`
        *,
        employee:profiles!schedules_employee_id_fkey(id, full_name, employee_id),
        branch:branches!schedules_branch_id_fkey(id, name),
        creator:profiles!schedules_created_by_fkey(id, full_name)
      `)
      .single();

    if (error) {
      console.error('Error creating schedule:', error);
      return NextResponse.json(
        { error: 'Failed to create schedule' }, 
        { status: 500 }
      );
    }

    // Send notification to employee about new schedule assignment
    try {
      if (schedule.employee?.email) {
        const notificationService = getHRNotificationService();
        await notificationService.sendScheduleUpdateNotification({
          employeeName: schedule.employee.full_name,
          employeeEmail: schedule.employee.email,
          updateType: 'assigned',
          scheduleDate: schedule.shift_date,
          startTime: schedule.start_time,
          endTime: schedule.end_time,
          position: schedule.position || 'Staff',
          updatedBy: schedule.creator?.full_name || 'System',
        });
      }
    } catch (notificationError) {
      console.warn('Failed to send schedule notification:', notificationError);
      // Don't fail the API call if notification fails
    }

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}