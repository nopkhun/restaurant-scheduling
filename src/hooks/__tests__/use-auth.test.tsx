import { renderHook, act, waitFor } from '@testing-library/react'
import { User } from '@supabase/supabase-js'
import { useAuth } from '../use-auth'

// Mock the auth utils
jest.mock('@/lib/auth/utils', () => ({
  getUserRole: jest.fn((user) => user?.user_metadata?.role || 'employee'),
  getUserBranchId: jest.fn((user) => user?.user_metadata?.branch_id || null),
  hasRole: jest.fn((user, role) => {
    const userRole = user?.user_metadata?.role || 'employee'
    return userRole === 'admin' || userRole === role
  }),
  canAccessBranch: jest.fn((user, branchId) => {
    const userRole = user?.user_metadata?.role || 'employee'
    const userBranchId = user?.user_metadata?.branch_id || null
    return userRole === 'admin' || userBranchId === branchId
  }),
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  getUserProfile: jest.fn(),
  createUserProfile: jest.fn(),
}))

// Mock the validation types
jest.mock('@/lib/validations/auth', () => ({
  LoginFormData: {},
  RegisterFormData: {},
}))

// Mock Supabase client - declare before using in jest.mock
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}))

// Import the mocked modules to get access to the mock functions
import * as authUtils from '@/lib/auth/utils'
import { supabase } from '@/lib/supabase/client'

const mockAuthUtils = authUtils as jest.Mocked<typeof authUtils>
const mockSupabase = supabase as jest.Mocked<typeof supabase>

describe('useAuth', () => {
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: {
      role: 'manager',
      branch_id: 'branch-123',
    },
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00.000Z',
  }

  const mockSubscription = {
    unsubscribe: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mock implementations
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: mockSubscription },
    })
    
    mockAuthUtils.getUserProfile.mockResolvedValue({
      data: { id: 'test-user-id', full_name: 'Test User' },
      error: null,
    })
  })

  test('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toBeNull()
    expect(result.current.profile).toBeNull()
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  test('should load user session on mount', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
    expect(mockAuthUtils.getUserProfile).toHaveBeenCalledWith('test-user-id')
  })

  test('should handle session loading error', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Session error' },
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  test('should handle auth state changes', async () => {
    let authStateCallback: (event: string, session: any) => void

    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback
      return { data: { subscription: mockSubscription } }
    })

    const { result } = renderHook(() => useAuth())

    // Simulate user sign in
    act(() => {
      authStateCallback('SIGNED_IN', { user: mockUser })
    })

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
    })

    // Simulate user sign out
    act(() => {
      authStateCallback('SIGNED_OUT', null)
    })

    await waitFor(() => {
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.profile).toBeNull()
    })
  })

  test('should cleanup subscription on unmount', () => {
    const { unmount } = renderHook(() => useAuth())

    unmount()

    expect(mockSubscription.unsubscribe).toHaveBeenCalled()
  })

  describe('signIn', () => {
    test('should sign in successfully', async () => {
      mockAuthUtils.signIn.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      let signInResult: any
      await act(async () => {
        signInResult = await result.current.signIn({
          email: 'test@example.com',
          password: 'password123',
        })
      })

      expect(mockAuthUtils.signIn).toHaveBeenCalledWith('test@example.com', 'password123')
      expect(signInResult.error).toBeNull()
      expect(result.current.error).toBeNull()
    })

    test('should handle sign in error', async () => {
      const errorMessage = 'Invalid credentials'
      mockAuthUtils.signIn.mockResolvedValue({
        data: null,
        error: { message: errorMessage },
      })

      const { result } = renderHook(() => useAuth())

      let signInResult: any
      await act(async () => {
        signInResult = await result.current.signIn({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      })

      expect(signInResult.error.message).toBe(errorMessage)
      expect(result.current.error).toBe(errorMessage)
      expect(result.current.loading).toBe(false)
    })
  })

  describe('signUp', () => {
    test('should sign up successfully', async () => {
      mockAuthUtils.signUp.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      })

      mockAuthUtils.createUserProfile.mockResolvedValue({
        data: { id: 'test-user-id' },
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      const signUpData = {
        email: 'test@example.com',
        password: 'password123',
        full_name: 'Test User',
        phone: '+66123456789',
        role: 'employee' as const,
        branch_id: 'branch-123',
        employee_id: 'EMP001',
      }

      let signUpResult: any
      await act(async () => {
        signUpResult = await result.current.signUp(signUpData)
      })

      expect(mockAuthUtils.signUp).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        {
          full_name: 'Test User',
          phone: '+66123456789',
          role: 'employee',
          branch_id: 'branch-123',
          employee_id: 'EMP001',
        }
      )

      expect(mockAuthUtils.createUserProfile).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({
          email: 'test@example.com',
          full_name: 'Test User',
          role: 'employee',
        })
      )

      expect(signUpResult.error).toBeNull()
    })

    test('should handle sign up error', async () => {
      const errorMessage = 'Email already exists'
      mockAuthUtils.signUp.mockResolvedValue({
        data: null,
        error: { message: errorMessage },
      })

      const { result } = renderHook(() => useAuth())

      let signUpResult: any
      await act(async () => {
        signUpResult = await result.current.signUp({
          email: 'existing@example.com',
          password: 'password123',
          full_name: 'Test User',
          role: 'employee',
        })
      })

      expect(signUpResult.error.message).toBe(errorMessage)
      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('signOut', () => {
    test('should sign out successfully', async () => {
      mockAuthUtils.signOut.mockResolvedValue({ error: null })

      const { result } = renderHook(() => useAuth())

      let signOutResult: any
      await act(async () => {
        signOutResult = await result.current.signOut()
      })

      expect(mockAuthUtils.signOut).toHaveBeenCalled()
      expect(signOutResult.error).toBeNull()
    })

    test('should handle sign out error', async () => {
      const errorMessage = 'Sign out failed'
      mockAuthUtils.signOut.mockResolvedValue({
        error: { message: errorMessage },
      })

      const { result } = renderHook(() => useAuth())

      let signOutResult: any
      await act(async () => {
        signOutResult = await result.current.signOut()
      })

      expect(signOutResult.error.message).toBe(errorMessage)
      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('helper functions', () => {
    test('should return correct user role', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.getUserRole()).toBe('manager')
      expect(result.current.isManager).toBe(true)
      expect(result.current.isAdmin).toBe(false)
      expect(result.current.isEmployee).toBe(false)
    })

    test('should return correct branch access', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.getUserBranchId()).toBe('branch-123')
      expect(result.current.canAccessBranch('branch-123')).toBe(true)
      expect(result.current.canAccessBranch('branch-456')).toBe(false)
    })

    test('should check roles correctly', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.hasRole('manager')).toBe(true)
      expect(result.current.hasRole('employee')).toBe(false)
      expect(result.current.hasRole('admin')).toBe(false)
    })
  })

  describe('profile loading', () => {
    test('should handle profile loading error gracefully', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      })

      mockAuthUtils.getUserProfile.mockResolvedValue({
        data: null,
        error: { message: 'Profile not found', code: 'PGRST116' },
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.profile).toBeNull()
      expect(result.current.error).toBeNull() // Should not set error for "not found"
    })

    test('should handle other profile errors', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      })

      mockAuthUtils.getUserProfile.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'PGRST000' },
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Database error')
    })
  })
})