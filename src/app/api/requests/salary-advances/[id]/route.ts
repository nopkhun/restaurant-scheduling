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

    const body = await request.json();
    const { action, reason, transaction_proof } = body;

    if (!action || !['approve', 'reject', 'process'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve", "reject", or "process"' },
        { status: 400 }
      );
    }

    // Check permissions for each action
    if (action === 'approve' || action === 'reject') {
      // Only managers, HR, and admins can approve/reject
      if (!['manager', 'hr', 'admin'].includes(profile.role)) {
        return NextResponse.json(
          { error: 'Insufficient permissions to approve/reject salary advance requests' },
          { status: 403 }
        );
      }
    } else if (action === 'process') {
      // Only HR, accounting, and admins can process payments
      if (!['hr', 'accounting', 'admin'].includes(profile.role)) {
        return NextResponse.json(
          { error: 'Insufficient permissions to process salary advance payments' },
          { status: 403 }
        );
      }
    }

    if (action === 'reject' && !reason?.trim()) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    if (action === 'process' && !transaction_proof?.trim()) {
      return NextResponse.json(
        { error: 'Transaction proof is required for processing' },
        { status: 400 }
      );
    }

    // Get the salary advance request
    const { data: advanceRequest, error: fetchError } = await supabase
      .from('salary_advance_requests')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !advanceRequest) {
      return NextResponse.json(
        { error: 'Salary advance request not found' },
        { status: 404 }
      );
    }

    // Check if request is in the correct status for the action
    if (action === 'approve' || action === 'reject') {
      if (advanceRequest.status !== 'pending') {
        return NextResponse.json(
          { error: 'Salary advance request has already been processed' },
          { status: 400 }
        );
      }
    } else if (action === 'process') {
      if (advanceRequest.status !== 'approved') {
        return NextResponse.json(
          { error: 'Salary advance request must be approved before processing' },
          { status: 400 }
        );
      }
    }

    // Update the salary advance request
    let updateData: any = {};

    if (action === 'approve') {
      updateData = {
        status: 'approved',
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
      };
    } else if (action === 'reject') {
      updateData = {
        status: 'rejected',
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
        rejection_reason: reason.trim(),
      };
    } else if (action === 'process') {
      updateData = {
        status: 'processed',
        processed_by: profile.id,
        processed_at: new Date().toISOString(),
        transaction_proof: transaction_proof.trim(),
      };
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('salary_advance_requests')
      .update(updateData)
      .eq('id', params.id)
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
      .single();

    if (updateError) {
      console.error('Error updating salary advance request:', updateError);
      return NextResponse.json(
        { error: 'Failed to update salary advance request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Salary advance request ${action}d successfully`,
      request: updatedRequest,
    });

  } catch (error) {
    console.error('Error in salary advance request action:', error);
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

    // Get the salary advance request with related data
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
      .eq('id', params.id)
      .single();

    const { data: advanceRequest, error: fetchError } = await query;

    if (fetchError || !advanceRequest) {
      return NextResponse.json(
        { error: 'Salary advance request not found' },
        { status: 404 }
      );
    }

    // Check permissions - employees can only view their own requests
    if (profile.role === 'employee' && advanceRequest.employee_id !== profile.id) {
      return NextResponse.json(
        { error: 'You can only view your own salary advance requests' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      request: advanceRequest,
    });

  } catch (error) {
    console.error('Error fetching salary advance request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}