import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Permissions } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    // Check permissions
    const hasPermission = Permissions.VIEW_EMPLOYEES({ 
      user, 
      branchId: branchId || null 
    });

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('profiles')
      .select('id, full_name, employee_id, role, branch_id, email, is_active')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    // Apply branch filter if specified
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: employees, error } = await query;

    if (error) {
      console.error('Error fetching employees:', error);
      return NextResponse.json(
        { error: 'Failed to fetch employees' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}