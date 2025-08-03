import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(1, 'Full name is required'),
  role: z.enum(['admin', 'hr', 'accounting', 'manager', 'employee'], {
    errorMap: () => ({ message: 'Invalid role' })
  }),
  hourly_rate: z.number().min(0, 'Hourly rate must be positive').optional(),
  employee_id: z.string().min(1, 'Employee ID is required').optional(),
  hire_date: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  emergency_contact: z.string().optional(),
  emergency_phone: z.string().optional(),
  branch_id: z.string().uuid('Invalid branch ID').optional(),
  send_invite: z.boolean().default(true),
});

const updateUserSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').optional(),
  role: z.enum(['admin', 'hr', 'accounting', 'manager', 'employee']).optional(),
  hourly_rate: z.number().min(0, 'Hourly rate must be positive').optional(),
  employee_id: z.string().min(1, 'Employee ID is required').optional(),
  hire_date: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  emergency_contact: z.string().optional(),
  emergency_phone: z.string().optional(),
  branch_id: z.string().uuid('Invalid branch ID').optional(),
  is_active: z.boolean().optional(),
});

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

    // Check permissions - only admins and HR can manage users
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

    if (!['admin', 'hr'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to manage users' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const branchId = searchParams.get('branch_id');

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        role,
        hourly_rate,
        employee_id,
        hire_date,
        phone,
        address,
        emergency_contact,
        emergency_phone,
        is_active,
        created_at,
        updated_at,
        branch:branches(id, name)
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,employee_id.ilike.%${search}%`);
    }

    if (role) {
      query = query.eq('role', role);
    }

    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    // Get total count for pagination
    const countQuery = supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    // Apply same filters to count query
    if (search) {
      countQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,employee_id.ilike.%${search}%`);
    }
    if (role) {
      countQuery.eq('role', role);
    }
    if (status === 'active') {
      countQuery.eq('is_active', true);
    } else if (status === 'inactive') {
      countQuery.eq('is_active', false);
    }
    if (branchId) {
      countQuery.eq('branch_id', branchId);
    }

    const [{ data: users, error: usersError }, { count, error: countError }] = await Promise.all([
      query.range(offset, offset + limit - 1),
      countQuery
    ]);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    if (countError) {
      console.error('Error fetching user count:', countError);
      return NextResponse.json(
        { error: 'Failed to fetch user count' },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      users: users || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });

  } catch (error) {
    console.error('Error in users API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    if (!['admin', 'hr'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create users' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues 
        }, 
        { status: 400 }
      );
    }

    const userData = validationResult.data;

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userData.email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Check if employee_id already exists (if provided)
    if (userData.employee_id) {
      const { data: existingEmployee } = await supabase
        .from('profiles')
        .select('id')
        .eq('employee_id', userData.employee_id)
        .single();

      if (existingEmployee) {
        return NextResponse.json(
          { error: 'Employee ID already exists' },
          { status: 409 }
        );
      }
    }

    // Create user in auth system if sending invite
    let authUser = null;
    if (userData.send_invite) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        email_confirm: true,
        user_metadata: {
          full_name: userData.full_name,
          role: userData.role,
        },
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        );
      }

      authUser = authData.user;
    }

    // Create profile
    const profileData = {
      ...(authUser && { id: authUser.id }),
      email: userData.email,
      full_name: userData.full_name,
      role: userData.role,
      hourly_rate: userData.hourly_rate,
      employee_id: userData.employee_id,
      hire_date: userData.hire_date,
      phone: userData.phone,
      address: userData.address,
      emergency_contact: userData.emergency_contact,
      emergency_phone: userData.emergency_phone,
      branch_id: userData.branch_id,
      is_active: true,
    };

    const { data: newProfile, error: profileCreateError } = await supabase
      .from('profiles')
      .insert(profileData)
      .select(`
        id,
        email,
        full_name,
        role,
        hourly_rate,
        employee_id,
        hire_date,
        phone,
        address,
        emergency_contact,
        emergency_phone,
        is_active,
        created_at,
        branch:branches(id, name)
      `)
      .single();

    if (profileCreateError) {
      console.error('Error creating profile:', profileCreateError);
      
      // Clean up auth user if profile creation failed
      if (authUser) {
        await supabase.auth.admin.deleteUser(authUser.id);
      }

      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: newProfile,
      invite_sent: userData.send_invite,
      message: userData.send_invite 
        ? 'User created and invitation sent successfully'
        : 'User profile created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}