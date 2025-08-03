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

    // Get statistics for shift swap requests
    const { data: stats, error } = await supabase
      .from('shift_swap_requests')
      .select('status')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching shift swap stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch statistics' },
        { status: 500 }
      );
    }

    // Calculate statistics
    const allRequests = stats || [];
    const pending = allRequests.filter(r => r.status === 'pending').length;
    const approved = allRequests.filter(r => r.status === 'approved').length;
    const rejected = allRequests.filter(r => r.status === 'rejected').length;
    const cancelled = allRequests.filter(r => r.status === 'cancelled').length;
    const total = allRequests.length;

    return NextResponse.json({
      stats: {
        pending,
        approved,
        rejected,
        cancelled,
        total,
      },
    });

  } catch (error) {
    console.error('Error in shift swap stats API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}