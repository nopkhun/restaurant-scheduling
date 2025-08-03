'use client';

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { 
  getUserRole as getRole, 
  getUserBranchId as getBranchId, 
  hasRole as checkRole,
  canAccessBranch as checkBranchAccess,
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  getUserProfile,
  createUserProfile
} from '@/lib/auth/utils';
import { UserRole } from '@/types/auth';
import type { LoginFormData, RegisterFormData } from '@/lib/validations/auth';

interface AuthState {
  user: User | null;
  profile: Record<string, unknown> | null; // Will be typed properly when database types are generated
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  // Initialize auth state and listen for changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        user: session?.user ?? null,
        loading: false,
      }));

      // Get user profile if authenticated
      if (session?.user) {
        loadUserProfile(session.user.id);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setState(prev => ({
        ...prev,
        user: session?.user ?? null,
        loading: false,
        error: null,
      }));

      // Load profile for new user
      if (session?.user) {
        await loadUserProfile(session.user.id);
      } else {
        setState(prev => ({ ...prev, profile: null }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await getUserProfile(userId);
      
      if (error && error.code !== 'PGRST116') { // Ignore "not found" errors
        console.error('Error loading user profile:', error);
        setState(prev => ({ ...prev, error: error.message }));
        return;
      }

      setState(prev => ({ ...prev, profile }));
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  };

  const signIn = async (credentials: LoginFormData) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const { data, error } = await authSignIn(credentials.email, credentials.password);
      
      if (error) {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: error.message 
        }));
        return { error };
      }

      return { data, error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage 
      }));
      return { error: new Error(errorMessage) };
    }
  };

  const signUp = async (formData: RegisterFormData) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const { data, error } = await authSignUp(
        formData.email,
        formData.password,
        {
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          branch_id: formData.branch_id,
          employee_id: formData.employee_id,
        }
      );
      
      if (error) {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: error.message 
        }));
        return { error };
      }

      // Create profile record
      if (data.user) {
        const profileResult = await createUserProfile(data.user.id, {
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          branch_id: formData.branch_id,
          employee_id: formData.employee_id,
        });

        if (profileResult.error) {
          console.error('Error creating user profile:', profileResult.error);
        }
      }

      return { data, error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage 
      }));
      return { error: new Error(errorMessage) };
    }
  };

  const signOut = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const { error } = await authSignOut();
      
      if (error) {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: error.message 
        }));
        return { error };
      }

      // State will be updated by the auth state change listener
      return { error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage 
      }));
      return { error: new Error(errorMessage) };
    }
  };

  // Helper functions using the current user
  const getUserRole = (): UserRole => {
    return getRole(state.user);
  };

  const getUserBranchId = (): string | null => {
    return getBranchId(state.user);
  };

  const hasRole = (requiredRole: UserRole): boolean => {
    return checkRole(state.user, requiredRole);
  };

  const canAccessBranch = (branchId: string | null): boolean => {
    return checkBranchAccess(state.user, branchId);
  };

  return {
    user: state.user,
    profile: state.profile,
    loading: state.loading,
    error: state.error,
    signIn,
    signUp,
    signOut,
    getUserRole,
    getUserBranchId,
    hasRole,
    canAccessBranch,
    isAuthenticated: !!state.user,
    isAdmin: getRole(state.user) === 'admin',
    isManager: getRole(state.user) === 'manager',
    isHR: getRole(state.user) === 'hr',
    isEmployee: getRole(state.user) === 'employee',
    isAccounting: getRole(state.user) === 'accounting',
  };
}