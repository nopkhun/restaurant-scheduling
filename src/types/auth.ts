export type UserRole = 'employee' | 'manager' | 'hr' | 'accounting' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  branch_id?: string;
  employee_id?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  full_name: string;
  phone?: string;
  role: UserRole;
  branch_id?: string;
  employee_id?: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  signUp: (data: RegisterData) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}