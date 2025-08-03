import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get the payroll period with related data
    const { data: period, error: periodError } = await supabase
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
      .eq('id', params.id)
      .single();

    if (periodError || !period) {
      return NextResponse.json(
        { error: 'Payroll period not found' },
        { status: 404 }
      );
    }

    // Get payroll entries for this period
    const { data: entries, error: entriesError } = await supabase
      .from('payroll_entries')
      .select(`
        *,
        employee:profiles!employee_id (
          full_name,
          employee_id
        ),
        approver:profiles!approved_by (
          full_name
        )
      `)
      .eq('payroll_period_id', params.id)
      .order('created_at', { ascending: false });

    if (entriesError) {
      console.error('Error fetching payroll entries:', entriesError);
      return NextResponse.json(
        { error: 'Failed to fetch payroll entries' },
        { status: 500 }
      );
    }

    // Calculate period summary
    const summary = {
      totalEmployees: entries?.length || 0,
      totalGrossSalary: entries?.reduce((sum, entry) => sum + entry.gross_salary, 0) || 0,
      totalNetSalary: entries?.reduce((sum, entry) => sum + entry.net_salary, 0) || 0,
      totalDeductions: entries?.reduce((sum, entry) => sum + (entry.social_security + entry.tax_deduction + entry.salary_advances + entry.other_deductions), 0) || 0,
      totalSocialSecurity: entries?.reduce((sum, entry) => sum + entry.social_security, 0) || 0,
      totalTax: entries?.reduce((sum, entry) => sum + entry.tax_deduction, 0) || 0,
      totalAdvances: entries?.reduce((sum, entry) => sum + entry.salary_advances, 0) || 0,
      statusCounts: {
        draft: entries?.filter(e => e.status === 'draft').length || 0,
        processing: entries?.filter(e => e.status === 'processing').length || 0,
        completed: entries?.filter(e => e.status === 'completed').length || 0,
        error: entries?.filter(e => e.status === 'error').length || 0,
      },
    };

    return NextResponse.json({
      period,
      entries: entries || [],
      summary,
    });

  } catch (error) {
    console.error('Error fetching payroll period:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        { error: 'Insufficient permissions to update payroll periods' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, notes } = body;

    if (!action || !['process', 'complete', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be process, complete, or cancel' },
        { status: 400 }
      );
    }

    // Get the current period
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', params.id)
      .single();

    if (periodError || !period) {
      return NextResponse.json(
        { error: 'Payroll period not found' },
        { status: 404 }
      );
    }

    let updateData: any = {};

    switch (action) {
      case 'process':
        if (period.status !== 'draft') {
          return NextResponse.json(
            { error: 'Can only process draft payroll periods' },
            { status: 400 }
          );
        }
        updateData = {
          status: 'processing',
          processed_by: profile.id,
          processed_at: new Date().toISOString(),
          notes: notes || period.notes,
        };
        break;

      case 'complete':
        if (period.status !== 'processing') {
          return NextResponse.json(
            { error: 'Can only complete processing payroll periods' },
            { status: 400 }
          );
        }
        updateData = {
          status: 'completed',
          notes: notes || period.notes,
        };
        break;

      case 'cancel':
        if (period.status === 'completed') {
          return NextResponse.json(
            { error: 'Cannot cancel completed payroll periods' },
            { status: 400 }
          );
        }
        updateData = {
          status: 'draft',
          processed_by: null,
          processed_at: null,
          notes: notes || period.notes,
        };
        break;
    }

    // Update the period
    const { data: updatedPeriod, error: updateError } = await supabase
      .from('payroll_periods')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        creator:profiles!created_by (
          full_name
        ),
        processor:profiles!processed_by (
          full_name
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating payroll period:', updateError);
      return NextResponse.json(
        { error: 'Failed to update payroll period' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Payroll period ${action}d successfully`,
      period: updatedPeriod,
    });

  } catch (error) {
    console.error('Error updating payroll period:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check permissions - only admins can delete payroll periods
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

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can delete payroll periods' },
        { status: 403 }
      );
    }

    // Check if period has any payroll entries
    const { data: entries, error: entriesError } = await supabase
      .from('payroll_entries')
      .select('id')
      .eq('payroll_period_id', params.id)
      .limit(1);

    if (entriesError) {
      console.error('Error checking payroll entries:', entriesError);
      return NextResponse.json(
        { error: 'Failed to check payroll entries' },
        { status: 500 }
      );
    }

    if (entries && entries.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete payroll period with existing payroll entries' },
        { status: 400 }
      );
    }

    // Delete the period
    const { error: deleteError } = await supabase
      .from('payroll_periods')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      console.error('Error deleting payroll period:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete payroll period' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Payroll period deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting payroll period:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}