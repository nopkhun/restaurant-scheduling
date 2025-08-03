-- Restaurant Employee Scheduling System Database Schema
-- This schema implements a comprehensive restaurant scheduling system with:
-- - Multi-branch support
-- - Role-based access control (RBAC)
-- - Employee scheduling and time tracking
-- - Request workflows (shift swaps, leave, salary advances)
-- - Payroll management

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('employee', 'manager', 'hr', 'accounting', 'admin');
CREATE TYPE schedule_status AS ENUM ('draft', 'published', 'completed');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE leave_type_enum AS ENUM ('vacation', 'sick', 'personal', 'emergency');
CREATE TYPE payroll_status AS ENUM ('draft', 'processing', 'completed', 'error');

-- ========================================
-- CORE TABLES
-- ========================================

-- Branches table
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  radius_meters INTEGER DEFAULT 50,
  timezone TEXT DEFAULT 'UTC',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'employee',
  branch_id UUID REFERENCES branches(id),
  employee_id TEXT UNIQUE,
  hire_date DATE,
  hourly_rate DECIMAL(8,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- SCHEDULING TABLES
-- ========================================

-- Schedules table
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  status schedule_status DEFAULT 'published',
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_shift_time CHECK (end_time > start_time),
  CONSTRAINT valid_break_minutes CHECK (break_minutes >= 0 AND break_minutes <= 480)
);

-- Time entries table
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  clock_in_time TIMESTAMPTZ,
  clock_out_time TIMESTAMPTZ,
  clock_in_location POINT,
  clock_out_location POINT,
  clock_in_accuracy INTEGER,
  clock_out_accuracy INTEGER,
  total_hours DECIMAL(4,2),
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_clock_times CHECK (
    (clock_in_time IS NULL AND clock_out_time IS NULL) OR
    (clock_in_time IS NOT NULL AND clock_out_time IS NULL) OR
    (clock_in_time IS NOT NULL AND clock_out_time IS NOT NULL AND clock_out_time > clock_in_time)
  ),
  CONSTRAINT valid_accuracy CHECK (
    (clock_in_accuracy IS NULL OR clock_in_accuracy >= 0) AND
    (clock_out_accuracy IS NULL OR clock_out_accuracy >= 0)
  )
);

-- ========================================
-- REQUEST TABLES
-- ========================================

-- Shift swap requests table
CREATE TABLE shift_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  requester_schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  target_employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  status request_status DEFAULT 'pending',
  reason TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT different_employees CHECK (requester_id != target_employee_id),
  CONSTRAINT different_schedules CHECK (requester_schedule_id != target_schedule_id)
);

-- Leave requests table
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  leave_type leave_type_enum NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL,
  reason TEXT,
  status request_status DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT valid_total_days CHECK (total_days > 0)
);

-- Salary advance requests table
CREATE TABLE salary_advance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  max_eligible_amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  status request_status DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  transaction_proof TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_amount CHECK (amount > 0 AND amount <= max_eligible_amount)
);

-- ========================================
-- PAYROLL TABLES
-- ========================================

-- Payroll periods table
CREATE TABLE payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status payroll_status DEFAULT 'draft',
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_payroll_period CHECK (end_date > start_date)
);

-- Payroll records table
CREATE TABLE payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id UUID REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  regular_hours DECIMAL(6,2) DEFAULT 0,
  overtime_hours DECIMAL(6,2) DEFAULT 0,
  gross_pay DECIMAL(10,2) NOT NULL,
  advance_deductions DECIMAL(10,2) DEFAULT 0,
  net_pay DECIMAL(10,2) NOT NULL,
  payslip_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_hours CHECK (regular_hours >= 0 AND overtime_hours >= 0),
  CONSTRAINT valid_pay CHECK (gross_pay >= 0 AND net_pay >= 0),
  CONSTRAINT valid_deductions CHECK (advance_deductions >= 0),
  
  -- Unique constraint to prevent duplicate payroll records
  UNIQUE(payroll_period_id, employee_id)
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Profiles indexes
CREATE INDEX idx_profiles_branch_id ON profiles(branch_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_employee_id ON profiles(employee_id);

-- Schedules indexes
CREATE INDEX idx_schedules_employee_date ON schedules(employee_id, shift_date);
CREATE INDEX idx_schedules_branch_date ON schedules(branch_id, shift_date);
CREATE INDEX idx_schedules_status ON schedules(status);

-- Time entries indexes
CREATE INDEX idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX idx_time_entries_schedule ON time_entries(schedule_id);
CREATE INDEX idx_time_entries_clock_in ON time_entries(clock_in_time);

-- Request indexes
CREATE INDEX idx_shift_swaps_requester ON shift_swap_requests(requester_id);
CREATE INDEX idx_shift_swaps_target ON shift_swap_requests(target_employee_id);
CREATE INDEX idx_shift_swaps_status ON shift_swap_requests(status);

CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);

CREATE INDEX idx_salary_advance_employee ON salary_advance_requests(employee_id);
CREATE INDEX idx_salary_advance_status ON salary_advance_requests(status);

-- Payroll indexes
CREATE INDEX idx_payroll_periods_branch ON payroll_periods(branch_id);
CREATE INDEX idx_payroll_periods_dates ON payroll_periods(start_date, end_date);
CREATE INDEX idx_payroll_records_period ON payroll_records(payroll_period_id);
CREATE INDEX idx_payroll_records_employee ON payroll_records(employee_id);

-- ========================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- STORED FUNCTIONS FOR BUSINESS LOGIC
-- ========================================

-- Function to calculate hours worked from time entry
CREATE OR REPLACE FUNCTION calculate_hours_worked(
  p_clock_in_time TIMESTAMPTZ,
  p_clock_out_time TIMESTAMPTZ,
  p_break_minutes INTEGER DEFAULT 0
) RETURNS DECIMAL(4,2) AS $$
DECLARE
  total_minutes INTEGER;
  hours_worked DECIMAL(4,2);
BEGIN
  IF p_clock_in_time IS NULL OR p_clock_out_time IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate total minutes worked minus break
  total_minutes := EXTRACT(EPOCH FROM (p_clock_out_time - p_clock_in_time)) / 60 - COALESCE(p_break_minutes, 0);
  
  -- Convert to hours (rounded to 2 decimal places)
  hours_worked := ROUND(total_minutes / 60.0, 2);
  
  -- Ensure non-negative result
  RETURN GREATEST(hours_worked, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to check schedule conflicts
CREATE OR REPLACE FUNCTION check_schedule_conflicts(
  p_employee_id UUID,
  p_shift_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_schedule_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  conflict_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO conflict_count
  FROM schedules
  WHERE employee_id = p_employee_id
    AND shift_date = p_shift_date
    AND status != 'draft'
    AND (p_schedule_id IS NULL OR id != p_schedule_id)
    AND (
      (start_time <= p_start_time AND end_time > p_start_time) OR
      (start_time < p_end_time AND end_time >= p_end_time) OR
      (start_time >= p_start_time AND end_time <= p_end_time)
    );
    
  RETURN conflict_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate maximum salary advance eligible amount
CREATE OR REPLACE FUNCTION calculate_max_advance_amount(
  p_employee_id UUID,
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL
) RETURNS DECIMAL(10,2) AS $$
DECLARE
  earned_amount DECIMAL(10,2) := 0;
  hourly_rate DECIMAL(8,2);
  total_hours DECIMAL(6,2) := 0;
  max_advance DECIMAL(10,2);
BEGIN
  -- Get employee hourly rate
  SELECT COALESCE(hourly_rate, 0) INTO hourly_rate
  FROM profiles
  WHERE id = p_employee_id;
  
  -- Set default period if not provided (current pay period)
  IF p_period_start IS NULL THEN
    p_period_start := DATE_TRUNC('month', CURRENT_DATE);
  END IF;
  
  IF p_period_end IS NULL THEN
    p_period_end := CURRENT_DATE;
  END IF;
  
  -- Calculate total hours worked in the period
  SELECT COALESCE(SUM(total_hours), 0)
  INTO total_hours
  FROM time_entries te
  JOIN schedules s ON te.schedule_id = s.id
  WHERE te.employee_id = p_employee_id
    AND s.shift_date BETWEEN p_period_start AND p_period_end
    AND te.is_verified = true;
  
  -- Calculate earned amount
  earned_amount := total_hours * hourly_rate;
  
  -- Maximum advance is 50% of earned amount
  max_advance := ROUND(earned_amount * 0.5, 2);
  
  RETURN GREATEST(max_advance, 0);
END;
$$ LANGUAGE plpgsql;