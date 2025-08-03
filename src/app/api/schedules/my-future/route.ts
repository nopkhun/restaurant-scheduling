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

    // Get future schedules for the current user (excluding today)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];

    const { data: schedules, error } = await supabase
      .from('schedules')
      .select(`
        id,
        shift_date,
        start_time,
        end_time,
        status,
        branches(
          name
        )
      `)
      .eq('employee_id', session.user.id)
      .gte('shift_date', tomorrowString)
      .eq('status', 'published')
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching user future schedules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch schedules' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      schedules: schedules || [],
    });

  } catch (error) {
    console.error('Error in my future schedules API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}