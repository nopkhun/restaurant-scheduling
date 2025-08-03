import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { 
  getHRNotificationService, 
  ScheduleUpdateNotification,
  LeaveRequestNotification,
  TimeTrackingNotification,
  SystemNotification
} from '@/lib/google-chat/hr-notifications';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id, full_name')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { type, data, spaceName } = body;

    if (!type || !data) {
      return NextResponse.json(
        { error: 'Notification type and data are required' },
        { status: 400 }
      );
    }

    const notificationService = getHRNotificationService();
    let result;

    try {
      switch (type) {
        case 'schedule_update':
          // Only HR, managers, and admins can send schedule notifications
          if (!['hr', 'manager', 'admin'].includes(profile.role)) {
            return NextResponse.json(
              { error: 'Insufficient permissions to send schedule notifications' },
              { status: 403 }
            );
          }
          
          const scheduleData: ScheduleUpdateNotification = {
            ...data,
            updatedBy: profile.full_name,
          };
          result = await notificationService.sendScheduleUpdateNotification(scheduleData);
          break;

        case 'leave_request':
          // HR, managers, and admins can send leave notifications; employees can send for their own requests
          if (!['hr', 'manager', 'admin', 'employee'].includes(profile.role)) {
            return NextResponse.json(
              { error: 'Insufficient permissions to send leave request notifications' },
              { status: 403 }
            );
          }

          const leaveData: LeaveRequestNotification = {
            ...data,
            hrSpaceName: spaceName || process.env.GOOGLE_CHAT_DEFAULT_SPACE,
          };
          result = await notificationService.sendLeaveRequestNotification(leaveData);
          break;

        case 'time_tracking':
          // System can send time tracking notifications (usually automated)
          if (!['hr', 'manager', 'admin'].includes(profile.role)) {
            return NextResponse.json(
              { error: 'Insufficient permissions to send time tracking notifications' },
              { status: 403 }
            );
          }

          const timeData: TimeTrackingNotification = data;
          result = await notificationService.sendTimeTrackingNotification(timeData);
          break;

        case 'system':
          // Only admins can send system notifications
          if (profile.role !== 'admin') {
            return NextResponse.json(
              { error: 'Only administrators can send system notifications' },
              { status: 403 }
            );
          }

          const systemData: SystemNotification = data;
          result = await notificationService.sendSystemNotification(systemData, spaceName);
          break;

        default:
          return NextResponse.json(
            { error: `Unknown notification type: ${type}` },
            { status: 400 }
          );
      }

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: `${type} notification sent successfully`,
          type,
          sentBy: profile.full_name,
          timestamp: new Date().toISOString(),
        });
      } else {
        return NextResponse.json({
          success: false,
          error: result.error,
          message: `Failed to send ${type} notification`,
        }, { status: 500 });
      }

    } catch (error) {
      console.error(`Error sending ${type} notification:`, error);
      return NextResponse.json({
        success: false,
        error: 'Failed to send notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in notifications API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Return available notification types and their schemas
    return NextResponse.json({
      notificationTypes: [
        {
          type: 'schedule_update',
          name: 'Schedule Update Notification',
          description: 'Notify employees about schedule changes',
          permissions: ['hr', 'manager', 'admin'],
          schema: {
            employeeName: 'string (required)',
            employeeEmail: 'string (required)',
            updateType: 'assigned | changed | cancelled (required)',
            scheduleDate: 'string (ISO date, required)',
            startTime: 'string (required)',
            endTime: 'string (required)',
            position: 'string (required)',
            reason: 'string (optional)',
          },
        },
        {
          type: 'leave_request',
          name: 'Leave Request Notification',
          description: 'Notify about leave request status changes',
          permissions: ['hr', 'manager', 'admin', 'employee'],
          schema: {
            employeeName: 'string (required)',
            employeeEmail: 'string (required)',
            requestType: 'submitted | approved | rejected (required)',
            leaveType: 'string (required)',
            startDate: 'string (ISO date, required)',
            endDate: 'string (ISO date, required)',
            totalDays: 'number (required)',
            reason: 'string (optional)',
            reviewedBy: 'string (optional)',
          },
        },
        {
          type: 'time_tracking',
          name: 'Time Tracking Notification',
          description: 'Send time tracking reminders and alerts',
          permissions: ['hr', 'manager', 'admin'],
          schema: {
            employeeName: 'string (required)',
            employeeEmail: 'string (required)',
            notificationType: 'clock_in_reminder | clock_out_reminder | missed_clock_out | location_issue (required)',
            shiftDate: 'string (ISO date, required)',
            shiftTime: 'string (required)',
            location: 'string (optional)',
            details: 'string (optional)',
          },
        },
        {
          type: 'system',
          name: 'System Notification',
          description: 'Send system-wide announcements',
          permissions: ['admin'],
          schema: {
            type: 'system_maintenance | policy_update | general_announcement (required)',
            title: 'string (required)',
            message: 'string (required)',
            priority: 'low | medium | high | urgent (required)',
            targetAudience: 'all | employees | hr | managers (required)',
            expiresAt: 'string (ISO date, optional)',
            actionRequired: 'boolean (optional)',
            actionUrl: 'string (optional)',
          },
        },
      ],
      usage: {
        endpoint: '/api/google-chat/notifications',
        method: 'POST',
        body: {
          type: 'notification_type',
          data: 'notification_data_object',
          spaceName: 'optional_space_name_for_group_notifications',
        },
      },
      examples: {
        schedule_update: {
          type: 'schedule_update',
          data: {
            employeeName: 'John Doe',
            employeeEmail: 'john@example.com',
            updateType: 'changed',
            scheduleDate: '2024-01-15',
            startTime: '09:00',
            endTime: '17:00',
            position: 'Server',
            reason: 'Coverage needed for sick employee',
          },
        },
        leave_request: {
          type: 'leave_request',
          data: {
            employeeName: 'Jane Smith',
            employeeEmail: 'jane@example.com',
            requestType: 'approved',
            leaveType: 'Vacation',
            startDate: '2024-01-20',
            endDate: '2024-01-25',
            totalDays: 5,
            reviewedBy: 'HR Manager',
          },
        },
      },
    });

  } catch (error) {
    console.error('Error in notifications info API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}