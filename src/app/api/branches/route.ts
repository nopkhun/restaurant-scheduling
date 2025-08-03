import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Permissions } from '@/lib/permissions';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const hasPermission = Permissions.VIEW_BRANCHES({ user });

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: branches, error } = await supabase
      .from('branches')
      .select('id, name, address, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching branches:', error);
      return NextResponse.json(
        { error: 'Failed to fetch branches' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ branches });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}