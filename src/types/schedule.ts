export type ScheduleStatus = 'draft' | 'published' | 'completed';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveType = 'vacation' | 'sick' | 'personal' | 'emergency';

export interface Schedule {
  id: string;
  employee_id: string;
  branch_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  status: ScheduleStatus;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleData {
  employee_id: string;
  branch_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  notes?: string;
}

export interface TimeEntry {
  id: string;
  employee_id: string;
  schedule_id: string;
  clock_in_time?: string;
  clock_out_time?: string;
  clock_in_location?: {
    latitude: number;
    longitude: number;
  };
  clock_out_location?: {
    latitude: number;
    longitude: number;
  };
  clock_in_accuracy?: number;
  clock_out_accuracy?: number;
  total_hours?: number;
  is_verified: boolean;
  created_at: string;
}

export interface ShiftSwapRequest {
  id: string;
  requester_id: string;
  requester_schedule_id: string;
  target_employee_id: string;
  target_schedule_id: string;
  status: RequestStatus;
  reason?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason?: string;
  status: RequestStatus;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

export interface SalaryAdvanceRequest {
  id: string;
  employee_id: string;
  amount: number;
  max_eligible_amount: number;
  reason?: string;
  status: RequestStatus;
  approved_by?: string;
  approved_at?: string;
  processed_by?: string;
  processed_at?: string;
  transaction_proof?: string;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  radius_meters: number;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

export interface LocationVerificationResult {
  verified: boolean;
  reason?: 'GPS_ACCURACY_TOO_LOW' | 'OUTSIDE_LOCATION_RADIUS' | 'IP_LOCATION_MISMATCH';
  distance?: number;
  accuracy?: number;
}