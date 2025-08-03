-- Sample data for Restaurant Employee Scheduling System
-- This seed data provides initial setup for development and testing

-- Clear existing data (be careful in production!)
TRUNCATE TABLE payroll_records, payroll_periods, salary_advance_requests, 
               leave_requests, shift_swap_requests, time_entries, schedules, 
               profiles, branches CASCADE;

-- ========================================
-- SAMPLE BRANCHES
-- ========================================

INSERT INTO branches (id, name, address, latitude, longitude, radius_meters, timezone) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Downtown Location', '123 Main St, Downtown City, NY 10001', 40.7128, -74.0060, 50, 'America/New_York'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Uptown Branch', '456 Broadway Ave, Uptown City, NY 10002', 40.7831, -73.9712, 75, 'America/New_York'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Suburban Outlet', '789 Oak Street, Suburb Town, NJ 07001', 40.6782, -74.1849, 60, 'America/New_York');

-- ========================================
-- SAMPLE ADMIN USER
-- ========================================
-- Note: This user must be created through Supabase Auth first
-- Then the profile record can be inserted

-- Sample admin profile (UUID will need to match actual auth.users record)
INSERT INTO profiles (id, email, full_name, role, branch_id, employee_id, hire_date, hourly_rate) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@restaurant.com', 'System Administrator', 'admin', NULL, 'ADMIN001', '2024-01-01', 25.00);

-- ========================================
-- SAMPLE EMPLOYEES
-- ========================================
-- Branch 1 - Downtown Location
INSERT INTO profiles (id, email, full_name, phone, role, branch_id, employee_id, hire_date, hourly_rate) VALUES
  -- Management
  ('11111111-1111-1111-1111-111111111001', 'manager1@restaurant.com', 'Alice Johnson', '+1-555-0101', 'manager', '550e8400-e29b-41d4-a716-446655440001', 'MGR001', '2024-01-15', 22.00),
  ('11111111-1111-1111-1111-111111111002', 'hr1@restaurant.com', 'Bob Smith', '+1-555-0102', 'hr', '550e8400-e29b-41d4-a716-446655440001', 'HR001', '2024-02-01', 20.00),
  
  -- Employees
  ('11111111-1111-1111-1111-111111111003', 'employee1@restaurant.com', 'Charlie Brown', '+1-555-0103', 'employee', '550e8400-e29b-41d4-a716-446655440001', 'EMP001', '2024-03-01', 15.50),
  ('11111111-1111-1111-1111-111111111004', 'employee2@restaurant.com', 'Diana Prince', '+1-555-0104', 'employee', '550e8400-e29b-41d4-a716-446655440001', 'EMP002', '2024-03-15', 16.00),
  ('11111111-1111-1111-1111-111111111005', 'employee3@restaurant.com', 'Edward Norton', '+1-555-0105', 'employee', '550e8400-e29b-41d4-a716-446655440001', 'EMP003', '2024-04-01', 15.75),

-- Branch 2 - Uptown Branch
  ('22222222-2222-2222-2222-222222222001', 'manager2@restaurant.com', 'Frank Miller', '+1-555-0201', 'manager', '550e8400-e29b-41d4-a716-446655440002', 'MGR002', '2024-01-20', 22.50),
  ('22222222-2222-2222-2222-222222222002', 'employee4@restaurant.com', 'Grace Kelly', '+1-555-0202', 'employee', '550e8400-e29b-41d4-a716-446655440002', 'EMP004', '2024-03-10', 16.25),
  ('22222222-2222-2222-2222-222222222003', 'employee5@restaurant.com', 'Henry Ford', '+1-555-0203', 'employee', '550e8400-e29b-41d4-a716-446655440002', 'EMP005', '2024-04-15', 15.50),

-- Branch 3 - Suburban Outlet
  ('33333333-3333-3333-3333-333333333001', 'manager3@restaurant.com', 'Isabel Martinez', '+1-555-0301', 'manager', '550e8400-e29b-41d4-a716-446655440003', 'MGR003', '2024-02-10', 21.75),
  ('33333333-3333-3333-3333-333333333002', 'employee6@restaurant.com', 'Jack Wilson', '+1-555-0302', 'employee', '550e8400-e29b-41d4-a716-446655440003', 'EMP006', '2024-03-20', 15.25);

-- Corporate roles
INSERT INTO profiles (id, email, full_name, phone, role, branch_id, employee_id, hire_date, hourly_rate) VALUES
  ('99999999-9999-9999-9999-999999999001', 'accounting@restaurant.com', 'Karen Davis', '+1-555-0901', 'accounting', NULL, 'ACC001', '2024-01-10', 24.00),
  ('99999999-9999-9999-9999-999999999002', 'hr-corporate@restaurant.com', 'Larry Thompson', '+1-555-0902', 'hr', NULL, 'HR002', '2024-01-05', 23.00);

-- ========================================
-- SAMPLE SCHEDULES (Current Week)
-- ========================================
-- Generate schedules for the current week
INSERT INTO schedules (employee_id, branch_id, shift_date, start_time, end_time, break_minutes, status, created_by) VALUES
  -- Downtown Location - Week Schedule
  ('11111111-1111-1111-1111-111111111003', '550e8400-e29b-41d4-a716-446655440001', CURRENT_DATE, '09:00', '17:00', 60, 'published', '11111111-1111-1111-1111-111111111001'),
  ('11111111-1111-1111-1111-111111111004', '550e8400-e29b-41d4-a716-446655440001', CURRENT_DATE, '10:00', '18:00', 60, 'published', '11111111-1111-1111-1111-111111111001'),
  ('11111111-1111-1111-1111-111111111005', '550e8400-e29b-41d4-a716-446655440001', CURRENT_DATE, '14:00', '22:00', 30, 'published', '11111111-1111-1111-1111-111111111001'),
  
  -- Tomorrow's schedule
  ('11111111-1111-1111-1111-111111111003', '550e8400-e29b-41d4-a716-446655440001', CURRENT_DATE + INTERVAL '1 day', '08:00', '16:00', 60, 'published', '11111111-1111-1111-1111-111111111001'),
  ('11111111-1111-1111-1111-111111111004', '550e8400-e29b-41d4-a716-446655440001', CURRENT_DATE + INTERVAL '1 day', '12:00', '20:00', 60, 'published', '11111111-1111-1111-1111-111111111001'),
  
  -- Uptown Branch - Week Schedule
  ('22222222-2222-2222-2222-222222222002', '550e8400-e29b-41d4-a716-446655440002', CURRENT_DATE, '11:00', '19:00', 60, 'published', '22222222-2222-2222-2222-222222222001'),
  ('22222222-2222-2222-2222-222222222003', '550e8400-e29b-41d4-a716-446655440002', CURRENT_DATE, '15:00', '23:00', 30, 'published', '22222222-2222-2222-2222-222222222001');

-- ========================================
-- SAMPLE TIME ENTRIES
-- ========================================
-- Some completed time entries for previous days
INSERT INTO time_entries (employee_id, schedule_id, clock_in_time, clock_out_time, clock_in_location, clock_out_location, clock_in_accuracy, clock_out_accuracy, total_hours, is_verified) 
SELECT 
  s.employee_id,
  s.id,
  (s.shift_date || ' ' || s.start_time)::timestamp + INTERVAL '5 minutes', -- Clocked in 5 min late
  (s.shift_date || ' ' || s.end_time)::timestamp - INTERVAL '10 minutes', -- Clocked out 10 min early
  POINT(40.7128, -74.0060), -- Sample location near Downtown branch
  POINT(40.7128, -74.0060),
  25, -- GPS accuracy in meters
  30,
  EXTRACT(EPOCH FROM (
    (s.shift_date || ' ' || s.end_time)::timestamp - INTERVAL '10 minutes' -
    (s.shift_date || ' ' || s.start_time)::timestamp - INTERVAL '5 minutes'
  )) / 3600 - (s.break_minutes / 60.0), -- Calculate hours worked
  true
FROM schedules s
WHERE s.shift_date < CURRENT_DATE - INTERVAL '1 day'
LIMIT 5;

-- ========================================
-- SAMPLE LEAVE REQUESTS
-- ========================================
INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days, reason, status) VALUES
  ('11111111-1111-1111-1111-111111111003', 'vacation', CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '9 days', 3, 'Family vacation to Florida', 'pending'),
  ('11111111-1111-1111-1111-111111111004', 'sick', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE - INTERVAL '2 days', 1, 'Food poisoning symptoms', 'approved'),
  ('22222222-2222-2222-2222-222222222002', 'personal', CURRENT_DATE + INTERVAL '14 days', CURRENT_DATE + INTERVAL '14 days', 1, 'Doctor appointment', 'pending');

-- ========================================
-- SAMPLE SHIFT SWAP REQUESTS
-- ========================================
INSERT INTO shift_swap_requests (requester_id, requester_schedule_id, target_employee_id, target_schedule_id, reason, status) 
SELECT 
  s1.employee_id,
  s1.id,
  s2.employee_id,
  s2.id,
  'Need to attend family event',
  'pending'
FROM schedules s1, schedules s2
WHERE s1.employee_id = '11111111-1111-1111-1111-111111111003'
  AND s2.employee_id = '11111111-1111-1111-1111-111111111004'
  AND s1.shift_date = CURRENT_DATE + INTERVAL '1 day'
  AND s2.shift_date = CURRENT_DATE + INTERVAL '1 day'
LIMIT 1;

-- ========================================
-- SAMPLE SALARY ADVANCE REQUESTS
-- ========================================
INSERT INTO salary_advance_requests (employee_id, amount, max_eligible_amount, reason, status) VALUES
  ('11111111-1111-1111-1111-111111111005', 200.00, 350.00, 'Emergency car repair needed', 'pending'),
  ('22222222-2222-2222-2222-222222222003', 150.00, 280.00, 'Medical expenses for family member', 'approved');

-- ========================================
-- SAMPLE PAYROLL PERIODS
-- ========================================
INSERT INTO payroll_periods (branch_id, start_date, end_date, status, processed_by) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'), DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day', 'completed', '11111111-1111-1111-1111-111111111002'),
  ('550e8400-e29b-41d4-a716-446655440002', DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'), DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day', 'completed', '22222222-2222-2222-2222-222222222001'),
  ('550e8400-e29b-41d4-a716-446655440001', DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month') - INTERVAL '1 day', 'draft', NULL);

-- ========================================
-- SAMPLE PAYROLL RECORDS
-- ========================================
-- Generate payroll records for completed payroll period
INSERT INTO payroll_records (payroll_period_id, employee_id, regular_hours, overtime_hours, gross_pay, advance_deductions, net_pay) 
SELECT 
  pp.id,
  p.id,
  80.0, -- Regular hours (2 weeks * 40 hours)
  5.0,  -- Overtime hours
  (80.0 * p.hourly_rate) + (5.0 * p.hourly_rate * 1.5), -- Gross pay with overtime
  0.0,  -- No advance deductions for now
  (80.0 * p.hourly_rate) + (5.0 * p.hourly_rate * 1.5)  -- Net pay (no deductions yet)
FROM payroll_periods pp
JOIN profiles p ON p.branch_id = pp.branch_id
WHERE pp.status = 'completed'
  AND p.role = 'employee'
LIMIT 10;

-- ========================================
-- UPDATE SEQUENCES
-- ========================================
-- Ensure sequences are set correctly after manual inserts
SELECT setval(pg_get_serial_sequence('branches', 'id'), (SELECT MAX(id::integer) FROM branches WHERE id ~ '^[0-9]+$'), true);

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- Uncomment to verify data was inserted correctly

-- SELECT 'Branches' as table_name, COUNT(*) as count FROM branches
-- UNION ALL
-- SELECT 'Profiles', COUNT(*) FROM profiles
-- UNION ALL
-- SELECT 'Schedules', COUNT(*) FROM schedules
-- UNION ALL
-- SELECT 'Time Entries', COUNT(*) FROM time_entries
-- UNION ALL
-- SELECT 'Leave Requests', COUNT(*) FROM leave_requests
-- UNION ALL
-- SELECT 'Shift Swap Requests', COUNT(*) FROM shift_swap_requests
-- UNION ALL
-- SELECT 'Salary Advance Requests', COUNT(*) FROM salary_advance_requests
-- UNION ALL
-- SELECT 'Payroll Periods', COUNT(*) FROM payroll_periods
-- UNION ALL
-- SELECT 'Payroll Records', COUNT(*) FROM payroll_records;