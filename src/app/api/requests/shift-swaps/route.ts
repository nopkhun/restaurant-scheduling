import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employee_id');

    // Build query for shift swap requests
    let query = supabase
      .from('shift_swap_requests')
      .select(`
        *,
        requester:profiles!shift_swap_requests_requester_id_fkey(
          full_name,
          employee_id
        ),
        target_employee:profiles!shift_swap_requests_target_employee_id_fkey(
          full_name,
          employee_id
        ),
        requester_schedule:schedules!shift_swap_requests_requester_schedule_id_fkey(
          id,
          shift_date,
          start_time,
          end_time,
          branches(name)
        ),
        target_schedule:schedules!shift_swap_requests_target_schedule_id_fkey(
          id,
          shift_date,
          start_time,
          end_time,
          branches(name)
        ),
        approver:profiles!shift_swap_requests_approved_by_fkey(
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by status if specified
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Filter by employee if specified (for employee view)
    if (employeeId) {
      query = query.or(`requester_id.eq.${employeeId},target_employee_id.eq.${employeeId}`);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error('Error fetching shift swap requests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch shift swap requests' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      requests: requests || [],
    });

  } catch (error) {
    console.error('Error in shift swap requests API:', error);
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

    const body = await request.json();
    const { requester_schedule_id, target_schedule_id, reason } = body;

    // Validate required fields
    if (!requester_schedule_id || !target_schedule_id || !reason) {
      return NextResponse.json(
        { error: 'Requester schedule, target schedule, and reason are required' },
        { status: 400 }
      );
    }

    // Verify the requester schedule belongs to the current user
    const { data: requesterSchedule, error: requesterError } = await supabase
      .from('schedules')
      .select('employee_id, shift_date, start_time, end_time')
      .eq('id', requester_schedule_id)
      .single();

    if (requesterError || !requesterSchedule) {
      return NextResponse.json(
        { error: 'Requester schedule not found' },
        { status: 404 }
      );
    }

    if (requesterSchedule.employee_id !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only create swap requests for your own schedules' },
        { status: 403 }
      );
    }

    // Verify the target schedule exists and get target employee
    const { data: targetSchedule, error: targetError } = await supabase
      .from('schedules')
      .select('employee_id, shift_date, start_time, end_time')
      .eq('id', target_schedule_id)
      .single();

    if (targetError || !targetSchedule) {
      return NextResponse.json(
        { error: 'Target schedule not found' },
        { status: 404 }
      );
    }

    if (targetSchedule.employee_id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot swap with your own schedule' },
        { status: 400 }
      );
    }

    // Check if the schedules are in the future
    const now = new Date();
    const requesterDate = new Date(requesterSchedule.shift_date);
    const targetDate = new Date(targetSchedule.shift_date);

    if (requesterDate <= now || targetDate <= now) {
      return NextResponse.json(
        { error: 'Cannot swap schedules that are in the past or today' },
        { status: 400 }
      );
    }

    // Check for existing pending swap request for either schedule
    const { data: existingRequest } = await supabase
      .from('shift_swap_requests')
      .select('id')
      .or(`requester_schedule_id.eq.${requester_schedule_id},target_schedule_id.eq.${target_schedule_id}`)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return NextResponse.json(
        { error: 'A pending swap request already exists for one of these schedules' },
        { status: 400 }
      );
    }

    // Create the swap request
    const { data: swapRequest, error: createError } = await supabase
      .from('shift_swap_requests')
      .insert({
        requester_id: session.user.id,
        requester_schedule_id,
        target_employee_id: targetSchedule.employee_id,
        target_schedule_id,
        reason,
        status: 'pending',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating swap request:', createError);
      return NextResponse.json(
        { error: 'Failed to create swap request' },
        { status: 500 }
      );
    }

    // TODO: Send notification to target employee and managers

    return NextResponse.json({
      request: swapRequest,
      message: 'Shift swap request created successfully',
    });

  } catch (error) {
    console.error('Error in shift swap request creation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}