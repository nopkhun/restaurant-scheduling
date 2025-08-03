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
      .from('salary_advance_requests')
      .select(`
        *,
        employee:profiles!employee_id (
          full_name,
          employee_id,
          hourly_rate
        ),
        approver:profiles!approved_by (
          full_name
        ),
        processor:profiles!processed_by (
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
      console.error('Error fetching salary advance requests:', requestsError);
      return NextResponse.json(
        { error: 'Failed to fetch salary advance requests' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      requests: requests || [],
    });

  } catch (error) {
    console.error('Error in salary advance requests API:', error);
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
      .select('role, id, hourly_rate')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Only employees can create salary advance requests
    if (profile.role !== 'employee') {
      return NextResponse.json(
        { error: 'Only employees can create salary advance requests' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { amount, reason } = body;

    // Validate required fields
    if (!amount || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Check if user has hourly rate set
    if (!profile.hourly_rate) {
      return NextResponse.json(
        { error: 'Hourly rate not set. Please contact HR to set your hourly rate.' },
        { status: 400 }
      );
    }

    // Calculate maximum eligible amount using the database function
    const { data: maxEligibleData, error: maxEligibleError } = await supabase
      .rpc('calculate_max_advance_amount', {
        p_employee_id: profile.id,
      });

    if (maxEligibleError) {
      console.error('Error calculating max eligible amount:', maxEligibleError);
      return NextResponse.json(
        { error: 'Failed to calculate eligibility' },
        { status: 500 }
      );
    }

    const maxEligibleAmount = maxEligibleData || 0;

    // Check if the requested amount is within limits
    if (amount > maxEligibleAmount) {
      return NextResponse.json(
        { error: `Requested amount exceeds maximum eligible amount of ${maxEligibleAmount.toLocaleString()} THB` },
        { status: 400 }
      );
    }

    // Check for existing pending/approved requests
    const { data: existingRequests, error: checkError } = await supabase
      .from('salary_advance_requests')
      .select('id, amount, status')
      .eq('employee_id', profile.id)
      .in('status', ['pending', 'approved']);

    if (checkError) {
      console.error('Error checking existing requests:', checkError);
      return NextResponse.json(
        { error: 'Failed to validate request' },
        { status: 500 }
      );
    }

    if (existingRequests && existingRequests.length > 0) {
      const totalExisting = existingRequests.reduce((sum, req) => sum + req.amount, 0);
      if (amount + totalExisting > maxEligibleAmount) {
        return NextResponse.json(
          { error: `Total advance amount would exceed maximum eligible amount. Current pending/approved: ${totalExisting.toLocaleString()} THB` },
          { status: 400 }
        );
      }
    }

    // Create the salary advance request
    const { data: newRequest, error: createError } = await supabase
      .from('salary_advance_requests')
      .insert({
        employee_id: profile.id,
        amount,
        max_eligible_amount: maxEligibleAmount,
        reason: reason.trim(),
        status: 'pending',
      })
      .select(`
        *,
        employee:profiles!employee_id (
          full_name,
          employee_id,
          hourly_rate
        )
      `)
      .single();

    if (createError) {
      console.error('Error creating salary advance request:', createError);
      return NextResponse.json(
        { error: 'Failed to create salary advance request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Salary advance request created successfully',
      request: newRequest,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in salary advance request creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}