import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateScheduleSchema } from '@/lib/validations/schedule';

// GET /api/schedules/[id] - Get specific schedule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: schedule, error } = await supabase
      .from('schedules')
      .select(`
        *,
        employee:profiles!schedules_employee_id_fkey(id, full_name, employee_id),
        branch:branches!schedules_branch_id_fkey(id, name),
        creator:profiles!schedules_created_by_fkey(id, full_name)
      `)
      .eq('id', resolvedParams.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
      }
      console.error('Error fetching schedule:', error);
      return NextResponse.json(
        { error: 'Failed to fetch schedule' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// PUT /api/schedules/[id] - Update schedule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = updateScheduleSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues 
        }, 
        { status: 400 }
      );
    }

    const { id: _scheduleId, ...updateData } = validationResult.data;

    // If updating schedule times, check for conflicts
    if (updateData.employee_id || updateData.shift_date || updateData.start_time || updateData.end_time) {
      // Get current schedule data for conflict checking
      const { data: currentSchedule, error: fetchError } = await supabase
        .from('schedules')
        .select('employee_id, shift_date, start_time, end_time')
        .eq('id', resolvedParams.id)
        .single();

      if (fetchError) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
      }

      const checkData = {
        employee_id: updateData.employee_id || currentSchedule.employee_id,
        shift_date: updateData.shift_date || currentSchedule.shift_date,
        start_time: updateData.start_time || currentSchedule.start_time,
        end_time: updateData.end_time || currentSchedule.end_time,
      };

      const { data: hasConflict, error: conflictError } = await supabase
        .rpc('check_schedule_conflicts', {
          p_employee_id: checkData.employee_id,
          p_shift_date: checkData.shift_date,
          p_start_time: checkData.start_time,
          p_end_time: checkData.end_time,
          p_schedule_id: resolvedParams.id
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
    }

    // Update the schedule
    const { data: schedule, error } = await supabase
      .from('schedules')
      .update(updateData)
      .eq('id', resolvedParams.id)
      .select(`
        *,
        employee:profiles!schedules_employee_id_fkey(id, full_name, employee_id),
        branch:branches!schedules_branch_id_fkey(id, name),
        creator:profiles!schedules_created_by_fkey(id, full_name)
      `)
      .single();

    if (error) {
      console.error('Error updating schedule:', error);
      return NextResponse.json(
        { error: 'Failed to update schedule' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// DELETE /api/schedules/[id] - Delete schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if schedule exists and user has permission to delete
    const { data: schedule, error: fetchError } = await supabase
      .from('schedules')
      .select('id, status')
      .eq('id', resolvedParams.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Failed to fetch schedule' }, 
        { status: 500 }
      );
    }

    // Prevent deletion of completed schedules
    if (schedule.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot delete completed schedules' }, 
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', resolvedParams.id);

    if (error) {
      console.error('Error deleting schedule:', error);
      return NextResponse.json(
        { error: 'Failed to delete schedule' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}