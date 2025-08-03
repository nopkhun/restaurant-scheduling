import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get user profile to check permissions
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

    // Only managers, HR, and admins can approve/reject leave requests
    if (!['manager', 'hr', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to approve/reject leave requests' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, reason } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    if (action === 'reject' && !reason?.trim()) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Get the leave request
    const { data: leaveRequest, error: fetchError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    // Check if request is still pending
    if (leaveRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Leave request has already been processed' },
        { status: 400 }
      );
    }

    // Update the leave request
    const updateData: any = {
      status: action === 'approve' ? 'approved' : 'rejected',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    };

    if (action === 'reject' && reason) {
      updateData.rejection_reason = reason.trim();
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('leave_requests')
      .update(updateData)
      .eq('id', params.id)
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
      .single();

    if (updateError) {
      console.error('Error updating leave request:', updateError);
      return NextResponse.json(
        { error: 'Failed to update leave request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Leave request ${action}d successfully`,
      request: updatedRequest,
    });

  } catch (error) {
    console.error('Error in leave request approval:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get the leave request with related data
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
      .eq('id', params.id)
      .single();

    const { data: leaveRequest, error: fetchError } = await query;

    if (fetchError || !leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    // Check permissions - employees can only view their own requests
    if (profile.role === 'employee' && leaveRequest.employee_id !== profile.id) {
      return NextResponse.json(
        { error: 'You can only view your own leave requests' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      request: leaveRequest,
    });

  } catch (error) {
    console.error('Error fetching leave request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}