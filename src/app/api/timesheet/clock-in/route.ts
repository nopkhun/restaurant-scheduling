import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { verifyLocation, type LocationCoords } from '@/lib/location/utils';
import { 
  validateLocationWithAntiSpoofing, 
  createLocationHistoryEntry,
  type ValidationContext,
  AntiSpoofingFlag 
} from '@/lib/location/anti-spoofing';

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
    const { schedule_id, location, accuracy } = body;

    // Validate required fields
    if (!schedule_id || !location || !accuracy) {
      return NextResponse.json(
        { error: 'Schedule ID, location, and accuracy are required' },
        { status: 400 }
      );
    }

    // Check if already clocked in today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingEntry } = await supabase
      .from('time_entries')
      .select('id, clock_out_time')
      .eq('employee_id', session.user.id)
      .gte('clock_in_time', `${today}T00:00:00.000Z`)
      .lt('clock_in_time', `${today}T23:59:59.999Z`)
      .single();

    if (existingEntry && !existingEntry.clock_out_time) {
      return NextResponse.json(
        { error: 'You are already clocked in. Please clock out first.' },
        { status: 400 }
      );
    }

    // Get schedule and branch information
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        *,
        branches(
          latitude,
          longitude,
          radius_meters,
          name
        )
      `)
      .eq('id', schedule_id)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Enhanced location verification with anti-spoofing
    let antiSpoofingResult = null;
    if (schedule.branches?.latitude && schedule.branches?.longitude) {
      const branchLocation: LocationCoords = {
        latitude: schedule.branches.latitude,
        longitude: schedule.branches.longitude,
      };

      // Get location history for anti-spoofing analysis
      const { data: locationHistory } = await supabase
        .from('time_entries')
        .select('clock_in_time, clock_in_location, clock_in_accuracy')
        .eq('employee_id', session.user.id)
        .not('clock_in_time', 'is', null)
        .order('clock_in_time', { ascending: false })
        .limit(20);

      // Get previous clock-ins for clustering analysis
      const { data: previousClockIns } = await supabase
        .from('time_entries')
        .select('clock_in_time, clock_in_location, clock_in_accuracy')
        .eq('employee_id', session.user.id)
        .not('clock_in_time', 'is', null)
        .gte('clock_in_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .order('clock_in_time', { ascending: false })
        .limit(50);

      // Convert to location history format (simplified for now)
      const historyEntries = (locationHistory || []).map(entry => ({
        latitude: location.latitude, // Simplified - in production, parse PostGIS POINT
        longitude: location.longitude,
        accuracy: entry.clock_in_accuracy || 50,
        timestamp: new Date(entry.clock_in_time).getTime(),
      }));

      const previousEntries = (previousClockIns || []).map(entry => ({
        latitude: location.latitude, // Simplified - in production, parse PostGIS POINT  
        longitude: location.longitude,
        accuracy: entry.clock_in_accuracy || 50,
        timestamp: new Date(entry.clock_in_time).getTime(),
      }));

      const validationContext: ValidationContext = {
        branchLocation,
        radiusMeters: schedule.branches.radius_meters || 50,
        employeeId: session.user.id,
        locationHistory: historyEntries,
        previousClockIns: previousEntries,
      };

      // Run comprehensive anti-spoofing validation
      antiSpoofingResult = await validateLocationWithAntiSpoofing(
        location,
        accuracy,
        validationContext
      );

      // Log anti-spoofing results for analysis
      console.log('Anti-spoofing validation:', {
        employeeId: session.user.id,
        riskScore: antiSpoofingResult.riskScore,
        flags: antiSpoofingResult.flags,
        isValid: antiSpoofingResult.isValid,
      });

      // Reject if high risk or specific critical flags
      const criticalFlags = [
        AntiSpoofingFlag.OUTSIDE_RADIUS,
        AntiSpoofingFlag.IMPOSSIBLE_SPEED,
      ];

      const hasCriticalFlags = antiSpoofingResult.flags.some(flag => 
        criticalFlags.includes(flag)
      );

      if (!antiSpoofingResult.isValid || hasCriticalFlags || antiSpoofingResult.riskScore > 70) {
        let errorMessage = 'Location verification failed due to security concerns. ';
        
        if (antiSpoofingResult.flags.includes(AntiSpoofingFlag.OUTSIDE_RADIUS)) {
          const basicVerification = antiSpoofingResult.details.basicVerification as any;
          const distance = basicVerification?.distance ? Math.round(basicVerification.distance) : 0;
          const radius = schedule.branches.radius_meters || 50;
          errorMessage += `You are ${distance}m from the workplace (max allowed: ${radius}m).`;
        } else if (antiSpoofingResult.riskScore > 70) {
          errorMessage += 'Multiple security flags detected. Please contact your manager.';
        } else {
          errorMessage += 'Please ensure you are at the correct location and try again.';
        }

        // Store the failed attempt for analysis
        await supabase
          .from('time_entries')
          .insert({
            employee_id: session.user.id,
            schedule_id,
            clock_in_time: null, // Mark as failed attempt
            clock_in_location: `POINT(${location.longitude} ${location.latitude})`,
            clock_in_accuracy: accuracy,
            is_verified: false,
            notes: `Failed anti-spoofing check: Risk score ${antiSpoofingResult.riskScore}, Flags: ${antiSpoofingResult.flags.join(', ')}`,
          });
        
        return NextResponse.json(
          { 
            error: errorMessage,
            riskScore: antiSpoofingResult.riskScore,
            flags: antiSpoofingResult.flags,
          },
          { status: 400 }
        );
      }
    }

    // Create clock-in entry with anti-spoofing metadata
    const clockInTime = new Date().toISOString();
    
    // Prepare anti-spoofing metadata for storage
    let antiSpoofingMetadata = null;
    if (antiSpoofingResult) {
      antiSpoofingMetadata = `Risk Score: ${antiSpoofingResult.riskScore}, Flags: ${antiSpoofingResult.flags.join(', ') || 'None'}`;
    }
    
    const { data: entry, error: entryError } = await supabase
      .from('time_entries')
      .insert({
        employee_id: session.user.id,
        schedule_id,
        clock_in_time: clockInTime,
        clock_in_location: `POINT(${location.longitude} ${location.latitude})`,
        clock_in_accuracy: accuracy,
        is_verified: false,
        notes: antiSpoofingMetadata,
      })
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

    if (entryError) {
      console.error('Error creating clock-in entry:', entryError);
      return NextResponse.json(
        { error: 'Failed to clock in' },
        { status: 500 }
      );
    }

    // Transform the entry for the response
    const responseEntry = {
      id: entry.id,
      schedule_id: entry.schedule_id,
      clock_in_time: entry.clock_in_time,
      clock_in_location: location,
      clock_in_accuracy: entry.clock_in_accuracy,
    };

    return NextResponse.json({
      entry: responseEntry,
      message: 'Clocked in successfully',
    });

  } catch (error) {
    console.error('Error in clock-in API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}