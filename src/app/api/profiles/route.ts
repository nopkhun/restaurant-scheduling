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

    // Only HR, accounting, admin, and managers can view profiles
    if (!['hr', 'accounting', 'admin', 'manager'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view profiles' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const active = searchParams.get('active');
    const branchId = searchParams.get('branch_id');

    // Build query
    let query = supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        phone,
        role,
        branch_id,
        employee_id,
        hire_date,
        hourly_rate,
        is_active,
        created_at,
        updated_at
      `)
      .order('full_name', { ascending: true });

    // Apply filters
    if (role) {
      query = query.eq('role', role);
    }

    if (active !== null) {
      query = query.eq('is_active', active === 'true');
    }

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    // For non-admin roles, limit access
    if (profile.role === 'manager') {
      // Managers can only see employees in their branch
      if (profile.branch_id) {
        query = query.eq('branch_id', profile.branch_id);
      }
    }

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return NextResponse.json(
        { error: 'Failed to fetch profiles' },
        { status: 500 }
      );
    }

    // Filter out sensitive information for non-admin users
    const filteredProfiles = profiles?.map(profile => {
      const { email, phone, ...publicData } = profile;
      
      // Only admins and HR can see email and phone
      if (['admin', 'hr'].includes(profile.role)) {
        return profile;
      }
      
      return publicData;
    });

    return NextResponse.json({
      profiles: filteredProfiles || [],
    });

  } catch (error) {
    console.error('Error in profiles API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}