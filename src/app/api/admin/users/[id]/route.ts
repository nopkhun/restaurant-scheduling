import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { z } from 'zod';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Admins and HR can view all users, employees can only view their own profile
    if (!['admin', 'hr'].includes(profile.role) && profile.id !== params.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view user details' },
        { status: 403 }
      );
    }

    // Get user details
    const { data: user, error: userError } = await supabase
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
        branch:branches(id, name),
        created_schedules:schedules!schedules_created_by_fkey(count),
        assigned_schedules:schedules!schedules_employee_id_fkey(count)
      `)
      .eq('id', id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get additional statistics for admin/HR view
    let stats = null;
    if (['admin', 'hr'].includes(profile.role)) {
      const [
        { count: totalShifts },
        { count: totalLeaveRequests },
        { count: totalPayslips }
      ] = await Promise.all([
        supabase
          .from('schedules')
          .select('id', { count: 'exact', head: true })
          .eq('employee_id', params.id),
        supabase
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .eq('employee_id', params.id),
        supabase
          .from('payslips')
          .select('id', { count: 'exact', head: true })
          .eq('employee_id', params.id)
      ]);

      stats = {
        totalShifts: totalShifts || 0,
        totalLeaveRequests: totalLeaveRequests || 0,
        totalPayslips: totalPayslips || 0,
      };
    }

    return NextResponse.json({
      user,
      stats,
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const body = await request.json();
    
    // Validate input
    const validationResult = updateUserSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues 
        }, 
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // Check if the user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('profiles')
      .select('id, role, employee_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Permission checks for different update types
    const isUpdatingSelf = profile.id === params.id;
    const isAdmin = profile.role === 'admin';
    const isHR = profile.role === 'hr';

    // Only admins can change roles
    if (updateData.role && !isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can change user roles' },
        { status: 403 }
      );
    }

    // Only admins and HR can update other users' profiles
    if (!isUpdatingSelf && !isAdmin && !isHR) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update user' },
        { status: 403 }
      );
    }

    // Employees can only update limited fields on their own profile
    if (isUpdatingSelf && !isAdmin && !isHR) {
      const allowedFields = ['phone', 'address', 'emergency_contact', 'emergency_phone'];
      const hasDisallowedFields = Object.keys(updateData).some(key => !allowedFields.includes(key));
      
      if (hasDisallowedFields) {
        return NextResponse.json(
          { error: 'You can only update phone, address, and emergency contact information' },
          { status: 403 }
        );
      }
    }

    // Check if employee_id is being changed and if it already exists
    if (updateData.employee_id && updateData.employee_id !== existingUser.employee_id) {
      const { data: duplicateEmployee } = await supabase
        .from('profiles')
        .select('id')
        .eq('employee_id', updateData.employee_id)
        .neq('id', params.id)
        .single();

      if (duplicateEmployee) {
        return NextResponse.json(
          { error: 'Employee ID already exists' },
          { status: 409 }
        );
      }
    }

    // Update the user
    const { data: updatedUser, error: updateError } = await supabase
      .from('profiles')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
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
      .single();

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: updatedUser,
      message: 'User updated successfully',
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check permissions - only admins can delete users
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
        { error: 'Only administrators can delete users' },
        { status: 403 }
      );
    }

    // Prevent admin from deleting themselves
    if (profile.id === params.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', id)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check for dependencies (schedules, payslips, etc.)
    const [
      { count: scheduleCount },
      { count: payslipCount },
      { count: leaveRequestCount }
    ] = await Promise.all([
      supabase
        .from('schedules')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', params.id),
      supabase
        .from('payslips')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', params.id),
      supabase
        .from('leave_requests')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', params.id)
    ]);

    const hasDependencies = (scheduleCount || 0) > 0 || (payslipCount || 0) > 0 || (leaveRequestCount || 0) > 0;

    if (hasDependencies) {
      // Instead of deleting, deactivate the user
      const { data: deactivatedUser, error: deactivateError } = await supabase
        .from('profiles')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, full_name')
        .single();

      if (deactivateError) {
        console.error('Error deactivating user:', deactivateError);
        return NextResponse.json(
          { error: 'Failed to deactivate user' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'User has been deactivated instead of deleted due to existing data dependencies',
        action: 'deactivated',
        user: deactivatedUser,
        dependencies: {
          schedules: scheduleCount || 0,
          payslips: payslipCount || 0,
          leaveRequests: leaveRequestCount || 0,
        },
      });
    }

    // Delete from auth system first
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(params.id);
    
    if (authDeleteError) {
      console.warn('Error deleting auth user (may not exist):', authDeleteError);
      // Continue with profile deletion even if auth deletion fails
    }

    // Delete profile
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting user profile:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'User deleted successfully',
      action: 'deleted',
      user: { id: params.id, full_name: existingUser.full_name },
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}