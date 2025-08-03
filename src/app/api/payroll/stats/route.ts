import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { startOfYear, endOfYear, format } from 'date-fns';

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

    // Check permissions
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

    if (!['hr', 'accounting', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view payroll statistics' },
        { status: 403 }
      );
    }

    const now = new Date();
    const yearStart = format(startOfYear(now), 'yyyy-MM-dd');
    const yearEnd = format(endOfYear(now), 'yyyy-MM-dd');

    // Get current/latest payroll period
    const { data: currentPeriod, error: currentPeriodError } = await supabase
      .from('payroll_periods')
      .select(`
        id,
        period_start,
        period_end,
        cutoff_date,
        pay_date,
        status,
        notes
      `)
      .gte('period_start', yearStart)
      .lte('period_start', yearEnd)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    let currentPeriodStats = null;
    if (currentPeriod && !currentPeriodError) {
      // Get current period entries summary
      const { data: currentEntries, error: entriesError } = await supabase
        .from('payroll_entries')
        .select('gross_salary, net_salary')
        .eq('payroll_period_id', currentPeriod.id);

      if (!entriesError && currentEntries) {
        const totalGross = currentEntries.reduce((sum, entry) => sum + entry.gross_salary, 0);
        const totalNet = currentEntries.reduce((sum, entry) => sum + entry.net_salary, 0);
        
        // Calculate days until pay date
        const payDate = new Date(currentPeriod.pay_date);
        const today = new Date();
        const daysUntilPay = Math.ceil((payDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        currentPeriodStats = {
          id: currentPeriod.id,
          description: `${format(new Date(currentPeriod.period_start), 'MMM d')} - ${format(new Date(currentPeriod.period_end), 'MMM d, yyyy')}`,
          status: currentPeriod.status,
          totalEmployees: currentEntries.length,
          totalGross,
          totalNet,
          daysUntilPay: Math.max(0, daysUntilPay),
        };
      }
    }

    // Get year-to-date statistics
    const { data: ytdPeriods, error: ytdPeriodsError } = await supabase
      .from('payroll_periods')
      .select('id')
      .gte('period_start', yearStart)
      .lte('period_start', yearEnd);

    let ytdStats = {
      totalPeriods: 0,
      totalGross: 0,
      totalNet: 0,
      totalEmployees: 0,
    };

    if (ytdPeriods && !ytdPeriodsError) {
      ytdStats.totalPeriods = ytdPeriods.length;

      // Get all entries for YTD periods
      const periodIds = ytdPeriods.map(p => p.id);
      if (periodIds.length > 0) {
        const { data: ytdEntries, error: ytdEntriesError } = await supabase
          .from('payroll_entries')
          .select('gross_salary, net_salary, employee_id')
          .in('payroll_period_id', periodIds);

        if (!ytdEntriesError && ytdEntries) {
          ytdStats.totalGross = ytdEntries.reduce((sum, entry) => sum + entry.gross_salary, 0);
          ytdStats.totalNet = ytdEntries.reduce((sum, entry) => sum + entry.net_salary, 0);
          
          // Count unique employees
          const uniqueEmployees = new Set(ytdEntries.map(entry => entry.employee_id));
          ytdStats.totalEmployees = uniqueEmployees.size;
        }
      }
    }

    // Get recent activity
    const { data: recentPeriods, error: recentPeriodsError } = await supabase
      .from('payroll_periods')
      .select(`
        id,
        period_start,
        period_end,
        status,
        created_at,
        processed_at,
        creator:profiles!created_by (
          full_name
        ),
        processor:profiles!processed_by (
          full_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    const recentActivity = [];
    if (recentPeriods && !recentPeriodsError) {
      for (const period of recentPeriods) {
        // Period creation activity
        recentActivity.push({
          type: 'period_created',
          description: `Created payroll period for ${format(new Date(period.period_start), 'MMM d')} - ${format(new Date(period.period_end), 'MMM d, yyyy')}`,
          timestamp: period.created_at,
          user: period.creator?.full_name || 'Unknown',
        });

        // Period processing activity
        if (period.processed_at && period.processor) {
          const actionType = period.status === 'completed' ? 'completed' : 'processed';
          recentActivity.push({
            type: `period_${actionType}`,
            description: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} payroll period for ${format(new Date(period.period_start), 'MMM d')} - ${format(new Date(period.period_end), 'MMM d, yyyy')}`,
            timestamp: period.processed_at,
            user: period.processor.full_name,
          });
        }
      }
    }

    // Sort recent activity by timestamp
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      currentPeriod: currentPeriodStats,
      yearToDate: ytdStats,
      recentActivity: recentActivity.slice(0, 10), // Limit to 10 most recent
    });

  } catch (error) {
    console.error('Error in payroll stats API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}