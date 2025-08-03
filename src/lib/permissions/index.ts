import { User } from '@supabase/supabase-js';
import { getUserRole, hasRole, hasAnyRole, canAccessBranch } from '@/lib/auth/utils';

/**
 * Permission definitions for the restaurant scheduling system
 * Each permission is a function that takes a user and returns a boolean
 */

export interface PermissionContext {
  user: User | null;
  branchId?: string | null;
  resourceOwnerId?: string | null;
}

/**
 * Base permissions based on user roles
 */
export const Permissions = {
  // Authentication and profile management
  UPDATE_OWN_PROFILE: ({ user, resourceOwnerId }: PermissionContext): boolean => {
    return !!user && (getUserRole(user) === 'admin' || user.id === resourceOwnerId);
  },

  VIEW_OWN_PROFILE: ({ user, resourceOwnerId }: PermissionContext): boolean => {
    return !!user && user.id === resourceOwnerId;
  },

  // Employee management
  VIEW_EMPLOYEES: ({ user, branchId }: PermissionContext): boolean => {
    return hasAnyRole(user, ['manager', 'hr', 'admin']) && 
           (getUserRole(user) === 'admin' || canAccessBranch(user, branchId || null));
  },

  MANAGE_EMPLOYEES: ({ user, branchId }: PermissionContext): boolean => {
    return hasAnyRole(user, ['hr', 'admin']) && 
           (getUserRole(user) === 'admin' || canAccessBranch(user, branchId || null));
  },

  // Schedule management
  VIEW_OWN_SCHEDULE: ({ user, resourceOwnerId }: PermissionContext): boolean => {
    return !!user && user.id === resourceOwnerId;
  },

  VIEW_BRANCH_SCHEDULES: ({ user, branchId }: PermissionContext): boolean => {
    return hasAnyRole(user, ['manager', 'hr', 'admin']) && 
           (getUserRole(user) === 'admin' || canAccessBranch(user, branchId || null));
  },

  CREATE_SCHEDULES: ({ user, branchId }: PermissionContext): boolean => {
    return hasAnyRole(user, ['manager', 'admin']) && 
           (getUserRole(user) === 'admin' || canAccessBranch(user, branchId || null));
  },

  UPDATE_SCHEDULES: ({ user, branchId }: PermissionContext): boolean => {
    return hasAnyRole(user, ['manager', 'admin']) && 
           (getUserRole(user) === 'admin' || canAccessBranch(user, branchId || null));
  },

  DELETE_SCHEDULES: ({ user, branchId }: PermissionContext): boolean => {
    return hasAnyRole(user, ['manager', 'admin']) && 
           (getUserRole(user) === 'admin' || canAccessBranch(user, branchId || null));
  },

  // Time tracking
  CLOCK_IN_OUT: ({ user, resourceOwnerId }: PermissionContext): boolean => {
    return !!user && user.id === resourceOwnerId;
  },

  VIEW_OWN_TIME_ENTRIES: ({ user, resourceOwnerId }: PermissionContext): boolean => {
    return !!user && user.id === resourceOwnerId;
  },

  VIEW_BRANCH_TIME_ENTRIES: ({ user, branchId }: PermissionContext): boolean => {
    return hasAnyRole(user, ['manager', 'hr', 'accounting', 'admin']) && 
           (getUserRole(user) === 'admin' || canAccessBranch(user, branchId || null));
  },

  VERIFY_TIME_ENTRIES: ({ user, branchId }: PermissionContext): boolean => {
    return hasAnyRole(user, ['manager', 'hr', 'admin']) && 
           (getUserRole(user) === 'admin' || canAccessBranch(user, branchId || null));
  },

  // Request management (leave, shift swaps, salary advances)
  CREATE_LEAVE_REQUEST: ({ user, resourceOwnerId }: PermissionContext): boolean => {
    return !!user && user.id === resourceOwnerId;
  },

  VIEW_OWN_REQUESTS: ({ user, resourceOwnerId }: PermissionContext): boolean => {
    return !!user && user.id === resourceOwnerId;
  },

  VIEW_BRANCH_REQUESTS: ({ user, branchId }: PermissionContext): boolean => {
    return hasAnyRole(user, ['manager', 'hr', 'admin']) && 
           (getUserRole(user) === 'admin' || canAccessBranch(user, branchId || null));
  },

  APPROVE_LEAVE_REQUESTS: ({ user, branchId }: PermissionContext): boolean => {
    return hasAnyRole(user, ['manager', 'hr', 'admin']) && 
           (getUserRole(user) === 'admin' || canAccessBranch(user, branchId || null));
  },

  APPROVE_SHIFT_SWAPS: ({ user, branchId }: PermissionContext): boolean => {
    return hasAnyRole(user, ['manager', 'admin']) && 
           (getUserRole(user) === 'admin' || canAccessBranch(user, branchId || null));
  },

  APPROVE_SALARY_ADVANCES: ({ user, branchId }: PermissionContext): boolean => {
    return hasAnyRole(user, ['hr', 'admin']) && 
           (getUserRole(user) === 'admin' || canAccessBranch(user, branchId || null));
  },

  PROCESS_SALARY_ADVANCES: ({ user }: PermissionContext): boolean => {
    return hasAnyRole(user, ['accounting', 'admin']);
  },

  // Payroll management
  VIEW_PAYROLL: ({ user, branchId }: PermissionContext): boolean => {
    return hasAnyRole(user, ['hr', 'accounting', 'admin']) && 
           (getUserRole(user) === 'admin' || getUserRole(user) === 'accounting' || canAccessBranch(user, branchId || null));
  },

  PROCESS_PAYROLL: ({ user }: PermissionContext): boolean => {
    return hasAnyRole(user, ['accounting', 'admin']);
  },

  VIEW_OWN_PAYSLIPS: ({ user, resourceOwnerId }: PermissionContext): boolean => {
    return !!user && user.id === resourceOwnerId;
  },

  // Branch management
  VIEW_BRANCHES: ({ user }: PermissionContext): boolean => {
    return !!user; // All authenticated users can view branches they have access to
  },

  MANAGE_BRANCHES: ({ user }: PermissionContext): boolean => {
    return hasRole(user, 'admin');
  },

  // Reporting
  VIEW_REPORTS: ({ user, branchId }: PermissionContext): boolean => {
    return hasAnyRole(user, ['manager', 'hr', 'accounting', 'admin']) && 
           (getUserRole(user) === 'admin' || canAccessBranch(user, branchId || null));
  },

  // System administration
  MANAGE_SYSTEM_SETTINGS: ({ user }: PermissionContext): boolean => {
    return hasRole(user, 'admin');
  },

  MANAGE_USER_ROLES: ({ user }: PermissionContext): boolean => {
    return hasRole(user, 'admin');
  },

  VIEW_AUDIT_LOGS: ({ user }: PermissionContext): boolean => {
    return hasRole(user, 'admin');
  },
} as const;

/**
 * Helper function to check multiple permissions at once
 */
export function checkPermissions(
  permissions: (keyof typeof Permissions)[], 
  context: PermissionContext
): boolean {
  return permissions.every(permission => Permissions[permission](context));
}

/**
 * Helper function to check if user has any of the specified permissions
 */
export function hasAnyPermission(
  permissions: (keyof typeof Permissions)[], 
  context: PermissionContext
): boolean {
  return permissions.some(permission => Permissions[permission](context));
}

/**
 * Route-level permission guards
 */
export const RoutePermissions = {
  '/dashboard': ({ user }: PermissionContext) => !!user,
  '/dashboard/schedule': ({ user }: PermissionContext) => !!user,
  '/dashboard/employees': ({ user, branchId }: PermissionContext) => 
    Permissions.VIEW_EMPLOYEES({ user, branchId }),
  '/dashboard/requests': ({ user }: PermissionContext) => !!user,
  '/dashboard/timesheet': ({ user }: PermissionContext) => !!user,
  '/dashboard/payroll': ({ user, branchId }: PermissionContext) => 
    Permissions.VIEW_PAYROLL({ user, branchId }),
  '/dashboard/settings': ({ user }: PermissionContext) => 
    Permissions.MANAGE_SYSTEM_SETTINGS({ user }),
} as const;

/**
 * API endpoint permission guards
 */
export const APIPermissions = {
  'GET /api/schedules': ({ user, branchId }: PermissionContext) => 
    Permissions.VIEW_BRANCH_SCHEDULES({ user, branchId }),
  'POST /api/schedules': ({ user, branchId }: PermissionContext) => 
    Permissions.CREATE_SCHEDULES({ user, branchId }),
  'PUT /api/schedules': ({ user, branchId }: PermissionContext) => 
    Permissions.UPDATE_SCHEDULES({ user, branchId }),
  'DELETE /api/schedules': ({ user, branchId }: PermissionContext) => 
    Permissions.DELETE_SCHEDULES({ user, branchId }),
  
  'GET /api/payroll': ({ user, branchId }: PermissionContext) => 
    Permissions.VIEW_PAYROLL({ user, branchId }),
  'POST /api/payroll/process': ({ user }: PermissionContext) => 
    Permissions.PROCESS_PAYROLL({ user }),
    
  'POST /api/requests/approve': ({ user, branchId }: PermissionContext) => 
    Permissions.APPROVE_LEAVE_REQUESTS({ user, branchId }),
} as const;