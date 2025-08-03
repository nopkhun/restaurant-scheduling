import { z } from 'zod';

export const createScheduleSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  branch_id: z.string().uuid('Invalid branch ID'),
  shift_date: z.string().refine((date) => {
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
  }, 'Invalid date format'),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  break_minutes: z.number().min(0, 'Break minutes cannot be negative').max(480, 'Break cannot exceed 8 hours'),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
}).refine((data) => {
  const start = new Date(`2000-01-01T${data.start_time}`);
  const end = new Date(`2000-01-01T${data.end_time}`);
  return end > start;
}, {
  message: 'End time must be after start time',
  path: ['end_time'],
});

export const updateScheduleSchema = createScheduleSchema.partial().extend({
  id: z.string().uuid('Invalid schedule ID'),
});

export const leaveRequestSchema = z.object({
  leave_type: z.enum(['vacation', 'sick', 'personal', 'emergency']),
  start_date: z.string().refine((date) => {
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
  }, 'Invalid date format'),
  end_date: z.string().refine((date) => {
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
  }, 'Invalid date format'),
  reason: z.string().min(10, 'Please provide a reason (minimum 10 characters)').max(500, 'Reason cannot exceed 500 characters'),
}).refine((data) => new Date(data.end_date) >= new Date(data.start_date), {
  message: 'End date must be after or equal to start date',
  path: ['end_date'],
});

export const shiftSwapRequestSchema = z.object({
  requester_schedule_id: z.string().uuid('Invalid schedule ID'),
  target_employee_id: z.string().uuid('Invalid employee ID'),
  target_schedule_id: z.string().uuid('Invalid target schedule ID'),
  reason: z.string().min(10, 'Please provide a reason (minimum 10 characters)').max(500, 'Reason cannot exceed 500 characters'),
});

export const salaryAdvanceRequestSchema = z.object({
  amount: z.number().min(1, 'Amount must be greater than 0').max(10000, 'Amount cannot exceed $10,000'),
  reason: z.string().min(10, 'Please provide a reason (minimum 10 characters)').max(500, 'Reason cannot exceed 500 characters'),
});

export const timeEntrySchema = z.object({
  schedule_id: z.string().uuid('Invalid schedule ID'),
  clock_in_time: z.string().optional(),
  clock_out_time: z.string().optional(),
  clock_in_location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  clock_out_location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  clock_in_accuracy: z.number().min(0).optional(),
  clock_out_accuracy: z.number().min(0).optional(),
});

export const locationVerificationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0),
  branch_id: z.string().uuid('Invalid branch ID'),
});

export type CreateScheduleData = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleData = z.infer<typeof updateScheduleSchema>;
export type LeaveRequestData = z.infer<typeof leaveRequestSchema>;
export type ShiftSwapRequestData = z.infer<typeof shiftSwapRequestSchema>;
export type SalaryAdvanceRequestData = z.infer<typeof salaryAdvanceRequestSchema>;
export type TimeEntryData = z.infer<typeof timeEntrySchema>;
export type LocationVerificationData = z.infer<typeof locationVerificationSchema>;