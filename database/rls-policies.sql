-- Row Level Security (RLS) Policies
-- CRITICAL: These policies enforce multi-branch data isolation and role-based access control
-- All tables MUST have RLS enabled to prevent security vulnerabilities

-- ========================================
-- ENABLE RLS ON ALL TABLES
-- ========================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

-- ========================================
-- HELPER FUNCTIONS FOR POLICIES
-- ========================================

-- Function to get current user's role from JWT
CREATE OR REPLACE FUNCTION auth.user_role() RETURNS user_role AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'user_role')::user_role,
    'employee'::user_role
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to get current user's branch_id from JWT
CREATE OR REPLACE FUNCTION auth.user_branch_id() RETURNS uuid AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'branch_id')::uuid,
    (SELECT branch_id FROM profiles WHERE id = auth.uid())
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user is admin or has specific role
CREATE OR REPLACE FUNCTION auth.has_role(required_role user_role) RETURNS boolean AS $$
  SELECT auth.user_role() = 'admin' OR auth.user_role() = required_role;
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user can access branch data
CREATE OR REPLACE FUNCTION auth.can_access_branch(target_branch_id uuid) RETURNS boolean AS $$
  SELECT 
    auth.user_role() = 'admin' OR
    auth.user_branch_id() = target_branch_id OR
    target_branch_id IS NULL;
$$ LANGUAGE sql SECURITY DEFINER;

-- ========================================
-- BRANCHES TABLE POLICIES
-- ========================================

-- Admins can do everything with branches
CREATE POLICY "Admins can manage all branches" ON branches
  FOR ALL USING (auth.user_role() = 'admin');

-- Managers and HR can view their own branch
CREATE POLICY "Managers and HR can view own branch" ON branches
  FOR SELECT USING (
    auth.has_role('manager') OR auth.has_role('hr')
  ) AND auth.can_access_branch(id);

-- Employees can view their assigned branch
CREATE POLICY "Employees can view assigned branch" ON branches
  FOR SELECT USING (auth.can_access_branch(id));

-- ========================================
-- PROFILES TABLE POLICIES
-- ========================================

-- Users can view and update their own profile
CREATE POLICY "Users can manage own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Admins can manage all profiles
CREATE POLICY "Admins can manage all profiles" ON profiles
  FOR ALL USING (auth.user_role() = 'admin');

-- Managers can view employees in their branch
CREATE POLICY "Managers can view branch employees" ON profiles
  FOR SELECT USING (
    auth.has_role('manager') AND 
    auth.can_access_branch(branch_id)
  );

-- HR can view employees in their branch
CREATE POLICY "HR can view branch employees" ON profiles
  FOR SELECT USING (
    auth.has_role('hr') AND 
    auth.can_access_branch(branch_id)
  );

-- HR can update employee profiles in their branch
CREATE POLICY "HR can update branch employees" ON profiles
  FOR UPDATE USING (
    auth.has_role('hr') AND 
    auth.can_access_branch(branch_id)
  );

-- ========================================
-- SCHEDULES TABLE POLICIES
-- ========================================

-- Admins can manage all schedules
CREATE POLICY "Admins can manage all schedules" ON schedules
  FOR ALL USING (auth.user_role() = 'admin');

-- Employees can view their own schedules
CREATE POLICY "Employees can view own schedules" ON schedules
  FOR SELECT USING (auth.uid() = employee_id);

-- Managers can manage schedules in their branch
CREATE POLICY "Managers can manage branch schedules" ON schedules
  FOR ALL USING (
    auth.has_role('manager') AND 
    auth.can_access_branch(branch_id)
  );

-- HR can view schedules in their branch
CREATE POLICY "HR can view branch schedules" ON schedules
  FOR SELECT USING (
    auth.has_role('hr') AND 
    auth.can_access_branch(branch_id)
  );

-- ========================================
-- TIME ENTRIES TABLE POLICIES
-- ========================================

-- Admins can manage all time entries
CREATE POLICY "Admins can manage all time entries" ON time_entries
  FOR ALL USING (auth.user_role() = 'admin');

-- Employees can manage their own time entries
CREATE POLICY "Employees can manage own time entries" ON time_entries
  FOR ALL USING (auth.uid() = employee_id);

-- Managers can view time entries for their branch employees
CREATE POLICY "Managers can view branch time entries" ON time_entries
  FOR SELECT USING (
    auth.has_role('manager') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = time_entries.employee_id 
      AND auth.can_access_branch(p.branch_id)
    )
  );

-- HR can view time entries for their branch employees
CREATE POLICY "HR can view branch time entries" ON time_entries
  FOR SELECT USING (
    auth.has_role('hr') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = time_entries.employee_id 
      AND auth.can_access_branch(p.branch_id)
    )
  );

-- Accounting can view all time entries for payroll
CREATE POLICY "Accounting can view time entries for payroll" ON time_entries
  FOR SELECT USING (auth.has_role('accounting'));

-- ========================================
-- SHIFT SWAP REQUESTS TABLE POLICIES
-- ========================================

-- Admins can manage all shift swap requests
CREATE POLICY "Admins can manage all shift swap requests" ON shift_swap_requests
  FOR ALL USING (auth.user_role() = 'admin');

-- Employees can create and view their own requests
CREATE POLICY "Employees can manage own shift swap requests" ON shift_swap_requests
  FOR ALL USING (
    auth.uid() = requester_id OR 
    auth.uid() = target_employee_id
  );

-- Managers can view and approve requests in their branch
CREATE POLICY "Managers can manage branch shift swap requests" ON shift_swap_requests
  FOR ALL USING (
    auth.has_role('manager') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE (p.id = requester_id OR p.id = target_employee_id)
      AND auth.can_access_branch(p.branch_id)
    )
  );

-- ========================================
-- LEAVE REQUESTS TABLE POLICIES
-- ========================================

-- Admins can manage all leave requests
CREATE POLICY "Admins can manage all leave requests" ON leave_requests
  FOR ALL USING (auth.user_role() = 'admin');

-- Employees can create and view their own leave requests
CREATE POLICY "Employees can manage own leave requests" ON leave_requests
  FOR ALL USING (auth.uid() = employee_id);

-- Managers can view and approve leave requests in their branch
CREATE POLICY "Managers can manage branch leave requests" ON leave_requests
  FOR ALL USING (
    auth.has_role('manager') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = leave_requests.employee_id 
      AND auth.can_access_branch(p.branch_id)
    )
  );

-- HR can manage leave requests in their branch
CREATE POLICY "HR can manage branch leave requests" ON leave_requests
  FOR ALL USING (
    auth.has_role('hr') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = leave_requests.employee_id 
      AND auth.can_access_branch(p.branch_id)
    )
  );

-- ========================================
-- SALARY ADVANCE REQUESTS TABLE POLICIES
-- ========================================

-- Admins can manage all salary advance requests
CREATE POLICY "Admins can manage all salary advance requests" ON salary_advance_requests
  FOR ALL USING (auth.user_role() = 'admin');

-- Employees can create and view their own salary advance requests
CREATE POLICY "Employees can manage own salary advance requests" ON salary_advance_requests
  FOR ALL USING (auth.uid() = employee_id);

-- HR can view and approve salary advance requests in their branch
CREATE POLICY "HR can manage branch salary advance requests" ON salary_advance_requests
  FOR ALL USING (
    auth.has_role('hr') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = salary_advance_requests.employee_id 
      AND auth.can_access_branch(p.branch_id)
    )
  );

-- Accounting can view and process approved salary advance requests
CREATE POLICY "Accounting can process approved salary advances" ON salary_advance_requests
  FOR SELECT USING (auth.has_role('accounting'));

CREATE POLICY "Accounting can update processed salary advances" ON salary_advance_requests
  FOR UPDATE USING (
    auth.has_role('accounting') AND 
    status = 'approved'
  );

-- ========================================
-- PAYROLL PERIODS TABLE POLICIES
-- ========================================

-- Admins can manage all payroll periods
CREATE POLICY "Admins can manage all payroll periods" ON payroll_periods
  FOR ALL USING (auth.user_role() = 'admin');

-- HR can manage payroll periods for their branch
CREATE POLICY "HR can manage branch payroll periods" ON payroll_periods
  FOR ALL USING (
    auth.has_role('hr') AND 
    auth.can_access_branch(branch_id)
  );

-- Accounting can view all payroll periods
CREATE POLICY "Accounting can view all payroll periods" ON payroll_periods
  FOR SELECT USING (auth.has_role('accounting'));

-- Managers can view payroll periods for their branch
CREATE POLICY "Managers can view branch payroll periods" ON payroll_periods
  FOR SELECT USING (
    auth.has_role('manager') AND 
    auth.can_access_branch(branch_id)
  );

-- ========================================
-- PAYROLL RECORDS TABLE POLICIES
-- ========================================

-- Admins can manage all payroll records
CREATE POLICY "Admins can manage all payroll records" ON payroll_records
  FOR ALL USING (auth.user_role() = 'admin');

-- Employees can view their own payroll records
CREATE POLICY "Employees can view own payroll records" ON payroll_records
  FOR SELECT USING (auth.uid() = employee_id);

-- HR can manage payroll records for their branch employees
CREATE POLICY "HR can manage branch payroll records" ON payroll_records
  FOR ALL USING (
    auth.has_role('hr') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = payroll_records.employee_id 
      AND auth.can_access_branch(p.branch_id)
    )
  );

-- Accounting can manage all payroll records
CREATE POLICY "Accounting can manage all payroll records" ON payroll_records
  FOR ALL USING (auth.has_role('accounting'));

-- Managers can view payroll records for their branch employees
CREATE POLICY "Managers can view branch payroll records" ON payroll_records
  FOR SELECT USING (
    auth.has_role('manager') AND 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = payroll_records.employee_id 
      AND auth.can_access_branch(p.branch_id)
    )
  );

-- ========================================
-- IMPORTANT SECURITY NOTES
-- ========================================

-- 1. All policies depend on custom JWT claims (user_role, branch_id)
-- 2. These claims must be set via Supabase Auth Hooks
-- 3. Regular testing of policies is required to ensure data isolation
-- 4. Monitor query performance as RLS adds WHERE clauses to all queries
-- 5. Consider database indexes on columns used in RLS policies