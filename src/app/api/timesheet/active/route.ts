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

    // Find active time entry (clocked in but not clocked out)
    const { data: activeEntry, error } = await supabase
      .from('time_entries')
      .select(`
        id,
        schedule_id,
        clock_in_time,
        clock_in_location,
        clock_in_accuracy,
        schedules(
          shift_date,
          start_time,
          end_time,
          branches(
            name,
            latitude,
            longitude,
            radius_meters
          )
        )
      `)
      .eq('employee_id', session.user.id)
      .is('clock_out_time', null)
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error fetching active entry:', error);
      return NextResponse.json(
        { error: 'Failed to fetch active entry' },
        { status: 500 }
      );
    }

    // If no active entry found
    if (!activeEntry || error?.code === 'PGRST116') {
      return NextResponse.json({
        entry: null,
      });
    }

    // Parse location from PostGIS POINT format
    let clockInLocation = null;
    if (activeEntry.clock_in_location) {
      // Assuming the location is stored as POINT(longitude latitude)
      // For now, we'll return null and handle this in a future iteration
      // In production, you'd need to properly parse the PostGIS POINT format
      clockInLocation = null;
    }

    // Transform the entry for the response
    const responseEntry = {
      id: activeEntry.id,
      schedule_id: activeEntry.schedule_id,
      clock_in_time: activeEntry.clock_in_time,
      clock_in_location: clockInLocation,
      clock_in_accuracy: activeEntry.clock_in_accuracy,
    };

    return NextResponse.json({
      entry: responseEntry,
    });

  } catch (error) {
    console.error('Error in active entry API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}