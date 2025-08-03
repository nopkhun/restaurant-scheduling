import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { PayrollPeriodManager, PayrollFrequency } from '@/lib/payroll/periods';
import { format, parseISO, isValid } from 'date-fns';

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
        { error: 'Insufficient permissions to view payroll periods' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const year = searchParams.get('year');

    // Build query
    let query = supabase
      .from('payroll_periods')
      .select(`
        *,
        creator:profiles!created_by (
          full_name
        ),
        processor:profiles!processed_by (
          full_name
        )
      `)
      .order('period_start', { ascending: false });

    // Filter by status if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Filter by year if provided
    if (year) {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      query = query.gte('period_start', yearStart).lte('period_start', yearEnd);
    }

    const { data: periods, error: periodsError } = await query;

    if (periodsError) {
      console.error('Error fetching payroll periods:', periodsError);
      return NextResponse.json(
        { error: 'Failed to fetch payroll periods' },
        { status: 500 }
      );
    }

    // Add computed status for each period
    const periodsWithStatus = periods?.map(period => {
      const periodObj = {
        periodStart: parseISO(period.period_start),
        periodEnd: parseISO(period.period_end),
        cutoffDate: parseISO(period.cutoff_date),
        payDate: parseISO(period.pay_date),
        frequency: 'monthly' as PayrollFrequency, // Default to monthly
        description: period.notes || 'Payroll Period',
      };

      const computedStatus = PayrollPeriodManager.getPeriodStatus(periodObj);
      const canProcess = PayrollPeriodManager.canProcessPayroll(periodObj);
      const daysUntilPay = PayrollPeriodManager.getDaysUntilPayDate(periodObj);

      return {
        ...period,
        computedStatus,
        canProcess,
        daysUntilPay,
      };
    }) || [];

    return NextResponse.json({
      periods: periodsWithStatus,
    });

  } catch (error) {
    console.error('Error in payroll periods API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
        { error: 'Insufficient permissions to create payroll periods' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { frequency, startDate, cutoffDays, payDays, generateYear } = body;

    // Validate required fields
    if (!frequency) {
      return NextResponse.json(
        { error: 'Frequency is required' },
        { status: 400 }
      );
    }

    if (!['weekly', 'bi-weekly', 'monthly', 'custom'].includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency. Must be weekly, bi-weekly, monthly, or custom' },
        { status: 400 }
      );
    }

    const createdPeriods = [];

    if (generateYear) {
      // Generate periods for entire year
      const year = generateYear;
      if (typeof year !== 'number' || year < 2020 || year > 2030) {
        return NextResponse.json(
          { error: 'Invalid year. Must be between 2020 and 2030' },
          { status: 400 }
        );
      }

      const periods = PayrollPeriodManager.generatePeriodsForYear(
        year,
        frequency as PayrollFrequency,
        cutoffDays,
        payDays
      );

      // Insert all periods
      for (const period of periods) {
        // Check if period already exists
        const { data: existing } = await supabase
          .from('payroll_periods')
          .select('id')
          .eq('period_start', format(period.periodStart, 'yyyy-MM-dd'))
          .eq('period_end', format(period.periodEnd, 'yyyy-MM-dd'))
          .single();

        if (!existing) {
          const { data: newPeriod, error: createError } = await supabase
            .from('payroll_periods')
            .insert({
              period_start: format(period.periodStart, 'yyyy-MM-dd'),
              period_end: format(period.periodEnd, 'yyyy-MM-dd'),
              cutoff_date: format(period.cutoffDate, 'yyyy-MM-dd'),
              pay_date: format(period.payDate, 'yyyy-MM-dd'),
              status: 'draft',
              created_by: profile.id,
              notes: period.description,
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating payroll period:', createError);
            // Continue with other periods
          } else {
            createdPeriods.push(newPeriod);
          }
        }
      }
    } else {
      // Generate single period
      if (!startDate) {
        return NextResponse.json(
          { error: 'Start date is required for single period creation' },
          { status: 400 }
        );
      }

      const start = parseISO(startDate);
      if (!isValid(start)) {
        return NextResponse.json(
          { error: 'Invalid start date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }

      const period = PayrollPeriodManager.generatePeriod({
        frequency: frequency as PayrollFrequency,
        startDate: start,
        cutoffDays,
        payDays,
      });

      // Validate period
      const validationErrors = PayrollPeriodManager.validatePeriod(period);
      if (validationErrors.length > 0) {
        return NextResponse.json(
          { error: 'Period validation failed', details: validationErrors },
          { status: 400 }
        );
      }

      // Check if period already exists
      const { data: existing } = await supabase
        .from('payroll_periods')
        .select('id')
        .eq('period_start', format(period.periodStart, 'yyyy-MM-dd'))
        .eq('period_end', format(period.periodEnd, 'yyyy-MM-dd'))
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'Payroll period already exists for these dates' },
          { status: 400 }
        );
      }

      const { data: newPeriod, error: createError } = await supabase
        .from('payroll_periods')
        .insert({
          period_start: format(period.periodStart, 'yyyy-MM-dd'),
          period_end: format(period.periodEnd, 'yyyy-MM-dd'),
          cutoff_date: format(period.cutoffDate, 'yyyy-MM-dd'),
          pay_date: format(period.payDate, 'yyyy-MM-dd'),
          status: 'draft',
          created_by: profile.id,
          notes: period.description,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating payroll period:', createError);
        return NextResponse.json(
          { error: 'Failed to create payroll period' },
          { status: 500 }
        );
      }

      createdPeriods.push(newPeriod);
    }

    return NextResponse.json({
      message: `Successfully created ${createdPeriods.length} payroll period(s)`,
      periods: createdPeriods,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in payroll period creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}