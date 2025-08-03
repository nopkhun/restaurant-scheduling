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

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const employeeId = searchParams.get('employee_id') || session.user.id;

    // Build query
    let query = supabase
      .from('time_entries')
      .select(`
        *,
        schedules!inner(
          shift_date,
          start_time,
          end_time,
          employees:profiles!schedules_employee_id_fkey(
            full_name,
            employee_id
          ),
          branches(
            name
          )
        )
      `)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    // Add date filtering if provided
    if (startDate && endDate) {
      query = query
        .gte('schedules.shift_date', startDate)
        .lte('schedules.shift_date', endDate);
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error('Error fetching time entries:', error);
      return NextResponse.json(
        { error: 'Failed to fetch time entries' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      entries: entries || [],
    });

  } catch (error) {
    console.error('Error in time entries API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { schedule_id, clock_in_time, clock_out_time, clock_in_location, clock_out_location, clock_in_accuracy, clock_out_accuracy, notes } = body;

    // Validate required fields
    if (!schedule_id) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    // Create time entry
    const { data: entry, error } = await supabase
      .from('time_entries')
      .insert({
        employee_id: session.user.id,
        schedule_id,
        clock_in_time,
        clock_out_time,
        clock_in_location: clock_in_location ? `POINT(${clock_in_location.longitude} ${clock_in_location.latitude})` : null,
        clock_out_location: clock_out_location ? `POINT(${clock_out_location.longitude} ${clock_out_location.latitude})` : null,
        clock_in_accuracy,
        clock_out_accuracy,
        is_verified: false, // Will be verified by manager/system
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating time entry:', error);
      return NextResponse.json(
        { error: 'Failed to create time entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      entry,
      message: 'Time entry created successfully',
    });

  } catch (error) {
    console.error('Error in time entries API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}