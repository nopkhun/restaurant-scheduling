import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { startOfMonth, endOfMonth, format } from 'date-fns';

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

    // Only employees can check eligibility
    if (profile.role !== 'employee') {
      return NextResponse.json(
        { error: 'Only employees can check salary advance eligibility' },
        { status: 403 }
      );
    }

    // Check if hourly rate is set
    if (!profile.hourly_rate) {
      return NextResponse.json({
        eligibility: {
          maxAmount: 0,
          currentAdvances: 0,
          availableAmount: 0,
          isEligible: false,
          hoursWorked: 0,
          grossEarnings: 0,
          message: 'Hourly rate not set. Please contact HR.',
        },
      });
    }

    // Calculate current period (current month)
    const now = new Date();
    const periodStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const periodEnd = format(endOfMonth(now), 'yyyy-MM-dd');

    // Get worked hours for current period
    const { data: timeEntries, error: timeError } = await supabase
      .from('time_entries')
      .select('total_hours')
      .eq('employee_id', profile.id)
      .gte('clock_in_time', periodStart)
      .lte('clock_in_time', periodEnd + 'T23:59:59')
      .not('total_hours', 'is', null);

    if (timeError) {
      console.error('Error fetching time entries:', timeError);
      return NextResponse.json(
        { error: 'Failed to calculate worked hours' },
        { status: 500 }
      );
    }

    // Calculate total hours worked
    const totalHours = timeEntries?.reduce((sum, entry) => sum + (entry.total_hours || 0), 0) || 0;
    const grossEarnings = totalHours * profile.hourly_rate;

    // Calculate maximum eligible amount using database function
    const { data: maxEligibleAmount, error: maxEligibleError } = await supabase
      .rpc('calculate_max_advance_amount', {
        p_employee_id: profile.id,
        p_period_start: periodStart,
        p_period_end: periodEnd,
      });

    if (maxEligibleError) {
      console.error('Error calculating max eligible amount:', maxEligibleError);
      return NextResponse.json(
        { error: 'Failed to calculate maximum eligible amount' },
        { status: 500 }
      );
    }

    const maxAmount = maxEligibleAmount || 0;

    // Get current pending/approved advances
    const { data: currentAdvances, error: advancesError } = await supabase
      .from('salary_advance_requests')
      .select('amount')
      .eq('employee_id', profile.id)
      .in('status', ['pending', 'approved']);

    if (advancesError) {
      console.error('Error fetching current advances:', advancesError);
      return NextResponse.json(
        { error: 'Failed to check current advances' },
        { status: 500 }
      );
    }

    const currentAdvanceAmount = currentAdvances?.reduce((sum, advance) => sum + advance.amount, 0) || 0;
    const availableAmount = Math.max(0, maxAmount - currentAdvanceAmount);

    // Determine eligibility criteria
    const minimumHours = 40; // Minimum hours worked to be eligible
    const minimumEarnings = 5000; // Minimum earnings to be eligible
    
    const isEligible = totalHours >= minimumHours && 
                     grossEarnings >= minimumEarnings && 
                     availableAmount > 0 &&
                     maxAmount > 0;

    return NextResponse.json({
      eligibility: {
        maxAmount,
        currentAdvances: currentAdvanceAmount,
        availableAmount,
        isEligible,
        hoursWorked: totalHours,
        grossEarnings,
        criteria: {
          minimumHours,
          minimumEarnings,
          hasHoursRequirement: totalHours >= minimumHours,
          hasEarningsRequirement: grossEarnings >= minimumEarnings,
          hasAvailableAmount: availableAmount > 0,
        },
      },
    });

  } catch (error) {
    console.error('Error in salary advance eligibility API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}