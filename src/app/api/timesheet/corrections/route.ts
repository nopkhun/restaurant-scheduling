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
    const status = searchParams.get('status') || 'pending';
    const employeeId = searchParams.get('employee_id');

    // Build query for time entry correction requests
    let query = supabase
      .from('time_entry_corrections')
      .select(`
        *,
        employee:profiles!time_entry_corrections_employee_id_fkey(
          full_name,
          employee_id
        ),
        time_entry:time_entries!time_entry_corrections_entry_id_fkey(
          *,
          schedules(
            shift_date,
            start_time,
            end_time
          )
        ),
        approved_by_user:profiles!time_entry_corrections_approved_by_fkey(
          full_name
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });

    // Filter by employee if specified
    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    const { data: corrections, error } = await query;

    if (error) {
      console.error('Error fetching corrections:', error);
      return NextResponse.json(
        { error: 'Failed to fetch corrections' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      corrections: corrections || [],
    });

  } catch (error) {
    console.error('Error in corrections API:', error);
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
    const { 
      entry_id, 
      correction_type, 
      requested_clock_in_time, 
      requested_clock_out_time, 
      reason, 
      supporting_evidence 
    } = body;

    // Validate required fields
    if (!entry_id || !correction_type || !reason) {
      return NextResponse.json(
        { error: 'Entry ID, correction type, and reason are required' },
        { status: 400 }
      );
    }

    // Verify the time entry belongs to the user or user has permission
    const { data: timeEntry, error: entryError } = await supabase
      .from('time_entries')
      .select('employee_id')
      .eq('id', entry_id)
      .single();

    if (entryError || !timeEntry) {
      return NextResponse.json(
        { error: 'Time entry not found' },
        { status: 404 }
      );
    }

    // Check if user owns the entry or has manager privileges
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const canCorrect = timeEntry.employee_id === session.user.id || 
      ['manager', 'hr', 'admin'].includes(userProfile?.role || '');

    if (!canCorrect) {
      return NextResponse.json(
        { error: 'Unauthorized to correct this time entry' },
        { status: 403 }
      );
    }

    // Check for existing pending correction for this entry
    const { data: existingCorrection } = await supabase
      .from('time_entry_corrections')
      .select('id')
      .eq('entry_id', entry_id)
      .eq('status', 'pending')
      .single();

    if (existingCorrection) {
      return NextResponse.json(
        { error: 'A correction request is already pending for this time entry' },
        { status: 400 }
      );
    }

    // Create correction request
    const { data: correction, error: correctionError } = await supabase
      .from('time_entry_corrections')
      .insert({
        entry_id,
        employee_id: timeEntry.employee_id,
        correction_type,
        requested_clock_in_time,
        requested_clock_out_time,
        reason,
        supporting_evidence,
        status: 'pending',
        requested_by: session.user.id,
      })
      .select()
      .single();

    if (correctionError) {
      console.error('Error creating correction:', correctionError);
      return NextResponse.json(
        { error: 'Failed to create correction request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      correction,
      message: 'Correction request submitted successfully',
    });

  } catch (error) {
    console.error('Error in correction creation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}