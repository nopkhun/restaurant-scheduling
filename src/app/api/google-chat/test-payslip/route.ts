import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { getPayslipNotificationService } from '@/lib/google-chat/payslip-notifications';

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

    // Check permissions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, email, full_name')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (!['hr', 'accounting', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to test payslip notifications' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { recipientEmail, testType = 'individual' } = body;

    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'Recipient email is required' },
        { status: 400 }
      );
    }

    const notificationService = getPayslipNotificationService();

    try {
      let result;

      if (testType === 'individual') {
        // Test individual payslip notification
        result = await notificationService.sendTestPayslipNotification(recipientEmail);
      } else if (testType === 'reminder') {
        // Test payslip reminder
        result = await notificationService.sendPayslipReminder({
          employeeEmail: recipientEmail,
          employeeName: 'Test Employee',
          slipNumber: 'REMINDER-TEST-001',
          periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          periodEnd: new Date().toISOString(),
          netSalary: 25000,
          payslipUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payslips`,
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        });
      } else {
        return NextResponse.json(
          { error: 'Invalid test type. Use "individual" or "reminder"' },
          { status: 400 }
        );
      }

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: `Test ${testType} payslip notification sent successfully`,
          recipient: recipientEmail,
          testType,
          sentBy: profile.full_name,
          timestamp: new Date().toISOString(),
        });
      } else {
        return NextResponse.json({
          success: false,
          error: result.error,
          message: `Failed to send test ${testType} notification`,
        }, { status: 500 });
      }

    } catch (error) {
      console.error('Error sending test payslip notification:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to send test notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in test payslip notification API:', error);
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

    // Check permissions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (!['hr', 'accounting', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Return available test types and information
    return NextResponse.json({
      availableTests: [
        {
          type: 'individual',
          name: 'Individual Payslip Notification',
          description: 'Send a test payslip notification to a specific employee',
          requiredFields: ['recipientEmail'],
        },
        {
          type: 'reminder',
          name: 'Payslip Reminder',
          description: 'Send a test payslip reminder notification',
          requiredFields: ['recipientEmail'],
        },
      ],
      notes: [
        'Test notifications will include "TEST" in the content to distinguish from real notifications',
        'The recipient must have Google Chat access and the bot must be able to send direct messages',
        'Test notifications use sample data and do not reflect actual payroll information',
      ],
    });

  } catch (error) {
    console.error('Error in test payslip notification info API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}