import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's branch to limit to same branch employees
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('branch_id')
      .eq('id', session.user.id)
      .single();

    if (!userProfile?.branch_id) {
      return NextResponse.json({
        schedules: [],
      });
    }

    // Get future schedules from other employees in the same branch
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];

    // First get schedules that are not already in pending swap requests
    const { data: pendingSwapSchedules } = await supabase
      .from('shift_swap_requests')
      .select('requester_schedule_id, target_schedule_id')
      .eq('status', 'pending');

    const excludeScheduleIds = new Set();
    pendingSwapSchedules?.forEach(swap => {
      excludeScheduleIds.add(swap.requester_schedule_id);
      excludeScheduleIds.add(swap.target_schedule_id);
    });

    let query = supabase
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
        ),
        branches(
          name
        )
      `)
      .eq('branch_id', userProfile.branch_id)
      .neq('employee_id', session.user.id) // Exclude current user's schedules
      .gte('shift_date', tomorrowString)
      .eq('status', 'published')
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true });

    const { data: schedules, error } = await query;

    if (error) {
      console.error('Error fetching available schedules for swap:', error);
      return NextResponse.json(
        { error: 'Failed to fetch available schedules' },
        { status: 500 }
      );
    }

    // Filter out schedules that are already in pending swap requests
    const availableSchedules = (schedules || []).filter(schedule => 
      !excludeScheduleIds.has(schedule.id)
    );

    return NextResponse.json({
      schedules: availableSchedules,
    });

  } catch (error) {
    console.error('Error in available schedules for swap API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}