import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { verifyLocation, type LocationCoords } from '@/lib/location/utils';

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

    const body = await request.json();
    const { entry_id, location, accuracy } = body;

    // Validate required fields
    if (!entry_id || !location || !accuracy) {
      return NextResponse.json(
        { error: 'Entry ID, location, and accuracy are required' },
        { status: 400 }
      );
    }

    // Get the existing time entry with schedule and branch info
    const { data: timeEntry, error: entryError } = await supabase
      .from('time_entries')
      .select(`
        *,
        schedules!inner(
          *,
          branches(
            latitude,
            longitude,
            radius_meters,
            name
          )
        )
      `)
      .eq('id', entry_id)
      .eq('employee_id', session.user.id)
      .single();

    if (entryError || !timeEntry) {
      return NextResponse.json(
        { error: 'Time entry not found or unauthorized' },
        { status: 404 }
      );
    }

    // Check if already clocked out
    if (timeEntry.clock_out_time) {
      return NextResponse.json(
        { error: 'Already clocked out for this entry' },
        { status: 400 }
      );
    }

    // Verify location if branch has coordinates
    if (timeEntry.schedules.branches?.latitude && timeEntry.schedules.branches?.longitude) {
      const branchLocation: LocationCoords = {
        latitude: timeEntry.schedules.branches.latitude,
        longitude: timeEntry.schedules.branches.longitude,
      };

      const verification = await verifyLocation(
        location,
        accuracy,
        branchLocation,
        timeEntry.schedules.branches.radius_meters || 50
      );

      if (!verification.verified) {
        let errorMessage = 'Location verification failed: ';
        switch (verification.reason) {
          case 'GPS_ACCURACY_TOO_LOW':
            errorMessage += 'GPS accuracy is too low. Please move to an area with better signal.';
            break;
          case 'OUTSIDE_LOCATION_RADIUS':
            const distance = verification.distance ? Math.round(verification.distance) : 0;
            const radius = timeEntry.schedules.branches.radius_meters || 50;
            errorMessage += `You are ${distance}m from the workplace (max allowed: ${radius}m).`;
            break;
          case 'IP_LOCATION_MISMATCH':
            errorMessage += 'Location verification failed. Please contact your manager.';
            break;
          default:
            errorMessage += 'Unknown verification error.';
        }
        
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        );
      }
    }

    // Calculate total hours
    const clockOutTime = new Date();
    const clockInTime = new Date(timeEntry.clock_in_time);
    const totalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

    // Update time entry with clock-out information
    const { data: updatedEntry, error: updateError } = await supabase
      .from('time_entries')
      .update({
        clock_out_time: clockOutTime.toISOString(),
        clock_out_location: `POINT(${location.longitude} ${location.latitude})`,
        clock_out_accuracy: accuracy,
        total_hours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
      })
      .eq('id', entry_id)
      .select(`
        *,
        schedules(
          shift_date,
          start_time,
          end_time,
          branches(name)
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating clock-out entry:', updateError);
      return NextResponse.json(
        { error: 'Failed to clock out' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      entry: updatedEntry,
      total_hours: Math.round(totalHours * 100) / 100,
      message: 'Clocked out successfully',
    });

  } catch (error) {
    console.error('Error in clock-out API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}