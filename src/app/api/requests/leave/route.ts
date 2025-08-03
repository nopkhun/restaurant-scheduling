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

    // Get user profile to determine role
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
    const status = searchParams.get('status');

    // Build query based on user role
    let query = supabase
      .from('leave_requests')
      .select(`
        *,
        employee:profiles!employee_id (
          full_name,
          employee_id
        ),
        approver:profiles!approved_by (
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by status if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // For employees, only show their own requests
    if (profile.role === 'employee') {
      query = query.eq('employee_id', profile.id);
    }

    const { data: requests, error: requestsError } = await query;

    if (requestsError) {
      console.error('Error fetching leave requests:', requestsError);
      return NextResponse.json(
        { error: 'Failed to fetch leave requests' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      requests: requests || [],
    });

  } catch (error) {
    console.error('Error in leave requests API:', error);
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

    // Only employees can create leave requests
    if (profile.role !== 'employee') {
      return NextResponse.json(
        { error: 'Only employees can create leave requests' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { leave_type, start_date, end_date, total_days, reason } = body;

    // Validate required fields
    if (!leave_type || !start_date || !end_date || !total_days || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate leave type
    const validLeaveTypes = ['vacation', 'sick', 'personal', 'emergency'];
    if (!validLeaveTypes.includes(leave_type)) {
      return NextResponse.json(
        { error: 'Invalid leave type' },
        { status: 400 }
      );
    }

    // Validate dates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate <= today) {
      return NextResponse.json(
        { error: 'Leave cannot start today or in the past' },
        { status: 400 }
      );
    }

    if (endDate < startDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    // Check for overlapping leave requests
    const { data: existingRequests, error: checkError } = await supabase
      .from('leave_requests')
      .select('id')
      .eq('employee_id', profile.id)
      .in('status', ['pending', 'approved'])
      .or(`start_date.lte.${end_date},end_date.gte.${start_date}`);

    if (checkError) {
      console.error('Error checking existing requests:', checkError);
      return NextResponse.json(
        { error: 'Failed to validate request' },
        { status: 500 }
      );
    }

    if (existingRequests && existingRequests.length > 0) {
      return NextResponse.json(
        { error: 'You already have a leave request for overlapping dates' },
        { status: 400 }
      );
    }

    // Create the leave request
    const { data: newRequest, error: createError } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: profile.id,
        leave_type,
        start_date,
        end_date,
        total_days,
        reason: reason.trim(),
        status: 'pending',
      })
      .select(`
        *,
        employee:profiles!employee_id (
          full_name,
          employee_id
        )
      `)
      .single();

    if (createError) {
      console.error('Error creating leave request:', createError);
      return NextResponse.json(
        { error: 'Failed to create leave request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Leave request created successfully',
      request: newRequest,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in leave request creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}