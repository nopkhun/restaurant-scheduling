import { User } from '@supabase/supabase-js';
import { UserRole } from '@/types/auth';
import { supabase } from '@/lib/supabase/client';

/**
 * Extract user role from JWT token or database
 * CRITICAL: This should match the custom claims set by Auth Hooks
 */
export function getUserRole(user: User | null): UserRole {
  if (!user) return 'employee';
  
  // Try to get role from JWT custom claims first
  const role = user.user_metadata?.role || user.app_metadata?.role;
  
  if (role && ['employee', 'manager', 'hr', 'accounting', 'admin'].includes(role)) {
    return role as UserRole;
  }
  
  // Fallback to employee role
  return 'employee';
}

/**
 * Extract branch ID from JWT token or database
 */
export function getUserBranchId(user: User | null): string | null {
  if (!user) return null;
  
  return user.user_metadata?.branch_id || user.app_metadata?.branch_id || null;
}

/**
 * Check if user has specific role or admin privileges
 */
export function hasRole(user: User | null, requiredRole: UserRole): boolean {
  if (!user) return false;
  
  const userRole = getUserRole(user);
  return userRole === 'admin' || userRole === requiredRole;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(user: User | null, roles: UserRole[]): boolean {
  if (!user) return false;
  
  const userRole = getUserRole(user);
  return userRole === 'admin' || roles.includes(userRole);
}

/**
 * Check if user can access specific branch data
 */
export function canAccessBranch(user: User | null, branchId: string | null): boolean {
  if (!user) return false;
  
  const userRole = getUserRole(user);
  const userBranchId = getUserBranchId(user);
  
  // Admin can access all branches
  if (userRole === 'admin') return true;
  
  // Corporate roles (accounting, some HR) can access all branches
  if ((userRole === 'accounting' || userRole === 'hr') && !userBranchId) {
    return true;
  }
  
  // Branch-specific access
  return userBranchId === branchId;
}

/**
 * Check if user can approve requests
 */
export function canApproveRequests(user: User | null): boolean {
  return hasAnyRole(user, ['manager', 'hr', 'admin']);
}

/**
 * Check if user can manage schedules
 */
export function canManageSchedules(user: User | null): boolean {
  return hasAnyRole(user, ['manager', 'admin']);
}

/**
 * Check if user can view payroll data
 */
export function canViewPayroll(user: User | null): boolean {
  return hasAnyRole(user, ['hr', 'accounting', 'admin']);
}

/**
 * Check if user can process payroll
 */
export function canProcessPayroll(user: User | null): boolean {
  return hasAnyRole(user, ['accounting', 'admin']);
}

/**
 * Sign in user with email and password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

/**
 * Sign up new user
 */
export async function signUp(
  email: string,
  password: string,
  userData: {
    full_name: string;
    phone?: string;
    role?: UserRole;
    branch_id?: string;
    employee_id?: string;
  }
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData,
    },
  });

  return { data, error };
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Get current user session
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

/**
 * Update user profile in profiles table
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    full_name?: string;
    phone?: string;
    employee_id?: string;
  }
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  return { data, error };
}

/**
 * Check if user exists in profiles table
 */
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  return { data, error };
}

/**
 * Create user profile after successful registration
 */
export async function createUserProfile(
  userId: string,
  profileData: {
    email: string;
    full_name: string;
    phone?: string;
    role: UserRole;
    branch_id?: string;
    employee_id?: string;
    hire_date?: string;
    hourly_rate?: number;
  }
) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      ...profileData,
    })
    .select()
    .single();

  return { data, error };
}