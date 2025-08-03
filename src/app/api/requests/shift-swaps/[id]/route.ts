import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user permissions (managers and above can approve/reject)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!['manager', 'hr', 'admin'].includes(userProfile?.role || '')) {
      return NextResponse.json(
        { error: 'Insufficient permissions to approve/reject swap requests' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, reason } = body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Get the swap request with full details
    const { data: swapRequest, error: requestError } = await supabase
      .from('shift_swap_requests')
      .select(`
        *,
        requester_schedule:schedules!shift_swap_requests_requester_schedule_id_fkey(*),
        target_schedule:schedules!shift_swap_requests_target_schedule_id_fkey(*)
      `)
      .eq('id', id)
      .eq('status', 'pending')
      .single();

    if (requestError || !swapRequest) {
      return NextResponse.json(
        { error: 'Swap request not found or already processed' },
        { status: 404 }
      );
    }

    if (action === 'approve') {
      // Perform the actual schedule swap
      const { error: swapError } = await supabase.rpc('swap_schedules', {
        schedule1_id: swapRequest.requester_schedule_id,
        schedule2_id: swapRequest.target_schedule_id,
        employee1_id: swapRequest.requester_id,
        employee2_id: swapRequest.target_employee_id,
      });

      if (swapError) {
        console.error('Error swapping schedules:', swapError);
        
        // If RPC doesn't exist, do manual swap
        try {
          // Update requester's schedule to target employee
          await supabase
            .from('schedules')
            .update({ employee_id: swapRequest.target_employee_id })
            .eq('id', swapRequest.requester_schedule_id);

          // Update target's schedule to requester
          await supabase
            .from('schedules')
            .update({ employee_id: swapRequest.requester_id })
            .eq('id', swapRequest.target_schedule_id);
        } catch (manualSwapError) {
          console.error('Error with manual schedule swap:', manualSwapError);
          return NextResponse.json(
            { error: 'Failed to swap schedules' },
            { status: 500 }
          );
        }
      }

      // Update swap request status to approved
      const { data: updatedRequest, error: statusError } = await supabase
        .from('shift_swap_requests')
        .update({
          status: 'approved',
          approved_by: session.user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (statusError) {
        console.error('Error updating swap request status:', statusError);
        return NextResponse.json(
          { error: 'Failed to update swap request status' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        request: updatedRequest,
        message: 'Shift swap approved and schedules updated successfully',
      });

    } else {
      // Reject the swap request
      const { data: updatedRequest, error: statusError } = await supabase
        .from('shift_swap_requests')
        .update({
          status: 'rejected',
          approved_by: session.user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', id)
        .select()
        .single();

      if (statusError) {
        console.error('Error updating swap request status:', statusError);
        return NextResponse.json(
          { error: 'Failed to update swap request status' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        request: updatedRequest,
        message: 'Shift swap request rejected',
      });
    }

  } catch (error) {
    console.error('Error in shift swap approval API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the swap request to verify ownership
    const { data: swapRequest, error: requestError } = await supabase
      .from('shift_swap_requests')
      .select('requester_id, status')
      .eq('id', id)
      .single();

    if (requestError || !swapRequest) {
      return NextResponse.json(
        { error: 'Swap request not found' },
        { status: 404 }
      );
    }

    // Only allow the requester to cancel their own pending request
    if (swapRequest.requester_id !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only cancel your own swap requests' },
        { status: 403 }
      );
    }

    if (swapRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only cancel pending swap requests' },
        { status: 400 }
      );
    }

    // Update status to cancelled instead of deleting
    const { data: updatedRequest, error: updateError } = await supabase
      .from('shift_swap_requests')
      .update({
        status: 'cancelled',
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error cancelling swap request:', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel swap request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      request: updatedRequest,
      message: 'Shift swap request cancelled successfully',
    });

  } catch (error) {
    console.error('Error in shift swap cancellation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}