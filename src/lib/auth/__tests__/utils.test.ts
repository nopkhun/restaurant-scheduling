import { User } from '@supabase/supabase-js'
import {
  getUserRole,
  getUserBranchId,
  hasRole,
  hasAnyRole,
  canAccessBranch,
  canApproveRequests,
  canManageSchedules,
  canViewPayroll,
  canProcessPayroll,
} from '../utils'
import { UserRole } from '@/types/auth'

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
}))

describe('Auth Utils', () => {
  const createMockUser = (role: UserRole, branchId?: string): User => ({
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: {
      role,
      branch_id: branchId,
    },
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00.000Z',
  })

  describe('getUserRole', () => {
    test('should return employee for null user', () => {
      expect(getUserRole(null)).toBe('employee')
    })

    test('should return role from user_metadata', () => {
      const user = createMockUser('manager')
      expect(getUserRole(user)).toBe('manager')
    })

    test('should return role from app_metadata if user_metadata not available', () => {
      const user: User = {
        id: 'test-user-id',
        email: 'test@example.com',
        user_metadata: {},
        app_metadata: { role: 'hr' },
        aud: 'authenticated',
        created_at: '2024-01-01T00:00:00.000Z',
      }
      expect(getUserRole(user)).toBe('hr')
    })

    test('should fallback to employee for invalid role', () => {
      const user: User = {
        id: 'test-user-id',
        email: 'test@example.com',
        user_metadata: { role: 'invalid_role' },
        app_metadata: {},
        aud: 'authenticated',
        created_at: '2024-01-01T00:00:00.000Z',
      }
      expect(getUserRole(user)).toBe('employee')
    })

    test('should handle all valid roles', () => {
      const roles: UserRole[] = ['employee', 'manager', 'hr', 'accounting', 'admin']
      
      roles.forEach(role => {
        const user = createMockUser(role)
        expect(getUserRole(user)).toBe(role)
      })
    })
  })

  describe('getUserBranchId', () => {
    test('should return null for null user', () => {
      expect(getUserBranchId(null)).toBeNull()
    })

    test('should return branch_id from user_metadata', () => {
      const user = createMockUser('employee', 'branch-123')
      expect(getUserBranchId(user)).toBe('branch-123')
    })

    test('should return branch_id from app_metadata if user_metadata not available', () => {
      const user: User = {
        id: 'test-user-id',
        email: 'test@example.com',
        user_metadata: {},
        app_metadata: { branch_id: 'branch-456' },
        aud: 'authenticated',
        created_at: '2024-01-01T00:00:00.000Z',
      }
      expect(getUserBranchId(user)).toBe('branch-456')
    })

    test('should return null if no branch_id available', () => {
      const user = createMockUser('admin')
      expect(getUserBranchId(user)).toBeNull()
    })
  })

  describe('hasRole', () => {
    test('should return false for null user', () => {
      expect(hasRole(null, 'manager')).toBe(false)
    })

    test('should return true for exact role match', () => {
      const user = createMockUser('manager')
      expect(hasRole(user, 'manager')).toBe(true)
    })

    test('should return true for admin accessing any role', () => {
      const user = createMockUser('admin')
      expect(hasRole(user, 'employee')).toBe(true)
      expect(hasRole(user, 'manager')).toBe(true)
      expect(hasRole(user, 'hr')).toBe(true)
    })

    test('should return false for mismatched roles', () => {
      const user = createMockUser('employee')
      expect(hasRole(user, 'manager')).toBe(false)
      expect(hasRole(user, 'hr')).toBe(false)
    })
  })

  describe('hasAnyRole', () => {
    test('should return false for null user', () => {
      expect(hasAnyRole(null, ['manager', 'hr'])).toBe(false)
    })

    test('should return true if user has any of the specified roles', () => {
      const managerUser = createMockUser('manager')
      expect(hasAnyRole(managerUser, ['manager', 'hr'])).toBe(true)
      
      const hrUser = createMockUser('hr')
      expect(hasAnyRole(hrUser, ['manager', 'hr'])).toBe(true)
    })

    test('should return true for admin regardless of specified roles', () => {
      const adminUser = createMockUser('admin')
      expect(hasAnyRole(adminUser, ['employee'])).toBe(true)
      expect(hasAnyRole(adminUser, ['manager', 'hr'])).toBe(true)
    })

    test('should return false if user has none of the specified roles', () => {
      const employeeUser = createMockUser('employee')
      expect(hasAnyRole(employeeUser, ['manager', 'hr'])).toBe(false)
    })

    test('should handle empty roles array', () => {
      const user = createMockUser('employee')
      expect(hasAnyRole(user, [])).toBe(false)
    })
  })

  describe('canAccessBranch', () => {
    test('should return false for null user', () => {
      expect(canAccessBranch(null, 'branch-123')).toBe(false)
    })

    test('should return true for admin to access any branch', () => {
      const adminUser = createMockUser('admin', 'branch-123')
      expect(canAccessBranch(adminUser, 'branch-456')).toBe(true)
      expect(canAccessBranch(adminUser, null)).toBe(true)
    })

    test('should return true for corporate accounting to access any branch', () => {
      const accountingUser = createMockUser('accounting') // No branch_id = corporate
      expect(canAccessBranch(accountingUser, 'branch-123')).toBe(true)
      expect(canAccessBranch(accountingUser, 'branch-456')).toBe(true)
    })

    test('should return true for corporate HR to access any branch', () => {
      const hrUser = createMockUser('hr') // No branch_id = corporate
      expect(canAccessBranch(hrUser, 'branch-123')).toBe(true)
    })

    test('should return false for branch-specific HR accessing different branch', () => {
      const branchHrUser = createMockUser('hr', 'branch-123')
      expect(canAccessBranch(branchHrUser, 'branch-456')).toBe(false)
    })

    test('should return true for same branch access', () => {
      const branchUser = createMockUser('manager', 'branch-123')
      expect(canAccessBranch(branchUser, 'branch-123')).toBe(true)
    })

    test('should return false for different branch access', () => {
      const branchUser = createMockUser('employee', 'branch-123')
      expect(canAccessBranch(branchUser, 'branch-456')).toBe(false)
    })

    test('should handle null branch ID', () => {
      const branchUser = createMockUser('employee', 'branch-123')
      expect(canAccessBranch(branchUser, null)).toBe(false)
      
      const corporateUser = createMockUser('hr')
      expect(canAccessBranch(corporateUser, null)).toBe(true)
    })
  })

  describe('canApproveRequests', () => {
    test('should return false for null user', () => {
      expect(canApproveRequests(null)).toBe(false)
    })

    test('should return true for managers, HR, and admins', () => {
      expect(canApproveRequests(createMockUser('manager'))).toBe(true)
      expect(canApproveRequests(createMockUser('hr'))).toBe(true)
      expect(canApproveRequests(createMockUser('admin'))).toBe(true)
    })

    test('should return false for employees and accounting', () => {
      expect(canApproveRequests(createMockUser('employee'))).toBe(false)
      expect(canApproveRequests(createMockUser('accounting'))).toBe(false)
    })
  })

  describe('canManageSchedules', () => {
    test('should return false for null user', () => {
      expect(canManageSchedules(null)).toBe(false)
    })

    test('should return true for managers and admins', () => {
      expect(canManageSchedules(createMockUser('manager'))).toBe(true)
      expect(canManageSchedules(createMockUser('admin'))).toBe(true)
    })

    test('should return false for employees, HR, and accounting', () => {
      expect(canManageSchedules(createMockUser('employee'))).toBe(false)
      expect(canManageSchedules(createMockUser('hr'))).toBe(false)
      expect(canManageSchedules(createMockUser('accounting'))).toBe(false)
    })
  })

  describe('canViewPayroll', () => {
    test('should return false for null user', () => {
      expect(canViewPayroll(null)).toBe(false)
    })

    test('should return true for HR, accounting, and admins', () => {
      expect(canViewPayroll(createMockUser('hr'))).toBe(true)
      expect(canViewPayroll(createMockUser('accounting'))).toBe(true)
      expect(canViewPayroll(createMockUser('admin'))).toBe(true)
    })

    test('should return false for employees and managers', () => {
      expect(canViewPayroll(createMockUser('employee'))).toBe(false)
      expect(canViewPayroll(createMockUser('manager'))).toBe(false)
    })
  })

  describe('canProcessPayroll', () => {
    test('should return false for null user', () => {
      expect(canProcessPayroll(null)).toBe(false)
    })

    test('should return true for accounting and admins', () => {
      expect(canProcessPayroll(createMockUser('accounting'))).toBe(true)
      expect(canProcessPayroll(createMockUser('admin'))).toBe(true)
    })

    test('should return false for employees, managers, and HR', () => {
      expect(canProcessPayroll(createMockUser('employee'))).toBe(false)
      expect(canProcessPayroll(createMockUser('manager'))).toBe(false)
      expect(canProcessPayroll(createMockUser('hr'))).toBe(false)
    })
  })
})