import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
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
        { error: 'Insufficient permissions to approve/reject corrections' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, rejection_reason } = body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    if (action === 'reject' && !rejection_reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required when rejecting a correction' },
        { status: 400 }
      );
    }

    // Get the correction request with full details
    const { data: correction, error: correctionError } = await supabase
      .from('time_entry_corrections')
      .select(`
        *,
        time_entry:time_entries!time_entry_corrections_entry_id_fkey(*)
      `)
      .eq('id', id)
      .eq('status', 'pending')
      .single();

    if (correctionError || !correction) {
      return NextResponse.json(
        { error: 'Correction request not found or already processed' },
        { status: 404 }
      );
    }

    if (action === 'approve') {
      // Apply the correction to the time entry
      const updates: Record<string, unknown> = {};

      if (correction.correction_type === 'delete') {
        // Delete the time entry
        const { error: deleteError } = await supabase
          .from('time_entries')
          .delete()
          .eq('id', correction.entry_id);

        if (deleteError) {
          console.error('Error deleting time entry:', deleteError);
          return NextResponse.json(
            { error: 'Failed to delete time entry' },
            { status: 500 }
          );
        }
      } else {
        // Update time entry fields
        if (correction.correction_type === 'clock_in' || correction.correction_type === 'both') {
          updates.clock_in_time = correction.requested_clock_in_time;
        }

        if (correction.correction_type === 'clock_out' || correction.correction_type === 'both') {
          updates.clock_out_time = correction.requested_clock_out_time;
        }

        // Recalculate total hours if both times are available
        if (updates.clock_in_time && updates.clock_out_time) {
          const clockIn = new Date(updates.clock_in_time as string);
          const clockOut = new Date(updates.clock_out_time as string);
          const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
          updates.total_hours = Math.round(totalHours * 100) / 100;
        } else if (updates.clock_in_time && correction.time_entry.clock_out_time) {
          const clockIn = new Date(updates.clock_in_time as string);
          const clockOut = new Date(correction.time_entry.clock_out_time);
          const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
          updates.total_hours = Math.round(totalHours * 100) / 100;
        } else if (updates.clock_out_time && correction.time_entry.clock_in_time) {
          const clockIn = new Date(correction.time_entry.clock_in_time);
          const clockOut = new Date(updates.clock_out_time as string);
          const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
          updates.total_hours = Math.round(totalHours * 100) / 100;
        }

        // Reset verification status since entry was manually corrected
        updates.is_verified = false;

        const { error: updateError } = await supabase
          .from('time_entries')
          .update(updates)
          .eq('id', correction.entry_id);

        if (updateError) {
          console.error('Error updating time entry:', updateError);
          return NextResponse.json(
            { error: 'Failed to update time entry' },
            { status: 500 }
          );
        }
      }

      // Update correction status to approved
      const { data: updatedCorrection, error: statusError } = await supabase
        .from('time_entry_corrections')
        .update({
          status: 'approved',
          approved_by: session.user.id,
          approved_at: new Date().toISOString(),
          processing_notes: `Approved and applied by ${userProfile?.full_name || session.user.email}`,
        })
        .eq('id', id)
        .select()
        .single();

      if (statusError) {
        console.error('Error updating correction status:', statusError);
        return NextResponse.json(
          { error: 'Failed to update correction status' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        correction: updatedCorrection,
        message: 'Correction approved and applied successfully',
      });

    } else {
      // Reject the correction
      const { data: updatedCorrection, error: statusError } = await supabase
        .from('time_entry_corrections')
        .update({
          status: 'rejected',
          approved_by: session.user.id,
          approved_at: new Date().toISOString(),
          processing_notes: rejection_reason,
        })
        .eq('id', id)
        .select()
        .single();

      if (statusError) {
        console.error('Error updating correction status:', statusError);
        return NextResponse.json(
          { error: 'Failed to update correction status' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        correction: updatedCorrection,
        message: 'Correction rejected',
      });
    }

  } catch (error) {
    console.error('Error in correction approval API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}