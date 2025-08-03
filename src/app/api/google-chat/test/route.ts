import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { getGoogleChatClient } from '@/lib/google-chat/client';
import { getGoogleChatAuth } from '@/lib/google-chat/auth';
import { validateChatConfig } from '@/lib/google-chat/config';

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

    // Check permissions - only admins can test Google Chat
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can test Google Chat integration' },
        { status: 403 }
      );
    }

    const testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
    };

    // Test 1: Configuration validation
    try {
      const configValidation = validateChatConfig();
      testResults.tests.push({
        name: 'Configuration Validation',
        success: configValidation.isValid,
        message: configValidation.isValid 
          ? 'Google Chat configuration is valid'
          : `Configuration errors: ${configValidation.errors.join(', ')}`,
        errors: configValidation.errors,
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Configuration Validation',
        success: false,
        message: 'Failed to validate configuration',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 2: Authentication
    try {
      const auth = getGoogleChatAuth();
      const authResult = await auth.verifyAuth();
      testResults.tests.push({
        name: 'Authentication',
        success: authResult.success,
        message: authResult.success 
          ? 'Google Chat authentication successful'
          : `Authentication failed: ${authResult.error}`,
        error: authResult.error,
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Authentication',
        success: false,
        message: 'Failed to test authentication',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 3: API Connection
    try {
      const client = getGoogleChatClient();
      const connectionResult = await client.testConnection();
      testResults.tests.push({
        name: 'API Connection',
        success: connectionResult.success,
        message: connectionResult.success 
          ? `Successfully connected to Google Chat API. Found ${connectionResult.spaces} spaces.`
          : `API connection failed: ${connectionResult.error}`,
        spaces: connectionResult.spaces,
        error: connectionResult.error,
      });
    } catch (error) {
      testResults.tests.push({
        name: 'API Connection',
        success: false,
        message: 'Failed to test API connection',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 4: Webhook URL validation
    try {
      const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
      if (webhookUrl) {
        const url = new URL(webhookUrl);
        testResults.tests.push({
          name: 'Webhook URL',
          success: true,
          message: `Webhook URL is valid: ${url.origin}${url.pathname}`,
          url: webhookUrl,
        });
      } else {
        testResults.tests.push({
          name: 'Webhook URL',
          success: false,
          message: 'Webhook URL is not configured',
        });
      }
    } catch (error) {
      testResults.tests.push({
        name: 'Webhook URL',
        success: false,
        message: 'Invalid webhook URL format',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Overall status
    const allTestsPassed = testResults.tests.every(test => test.success);
    const passedTests = testResults.tests.filter(test => test.success).length;
    const totalTests = testResults.tests.length;

    return NextResponse.json({
      ...testResults,
      overall: {
        success: allTestsPassed,
        message: allTestsPassed 
          ? 'All Google Chat integration tests passed'
          : `${passedTests}/${totalTests} tests passed`,
        passed: passedTests,
        total: totalTests,
      },
    });

  } catch (error) {
    console.error('Error testing Google Chat integration:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

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

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can send test messages' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { messageType = 'test', recipient } = body;

    const client = getGoogleChatClient();

    try {
      let result;
      
      if (messageType === 'dm' && recipient) {
        // Send direct message to specific user
        result = await client.sendDirectMessage(recipient, {
          text: `🧪 **Test Message from Restaurant Scheduling System**\n\nHi! This is a test message to verify Google Chat integration is working correctly.\n\nSent by: ${profile.full_name}\nTime: ${new Date().toLocaleString()}\n\n✅ If you see this message, the integration is working!`,
        });
      } else {
        // Try to send to default space if configured
        const defaultSpace = process.env.GOOGLE_CHAT_DEFAULT_SPACE;
        if (!defaultSpace) {
          return NextResponse.json(
            { error: 'No default space configured for testing' },
            { status: 400 }
          );
        }

        result = await client.sendMessage(defaultSpace, {
          text: `🧪 **Test Message from Restaurant Scheduling System**\n\nThis is a test message to verify Google Chat integration is working correctly.\n\nSent by: ${profile.full_name}\nTime: ${new Date().toLocaleString()}\n\n✅ Integration test successful!`,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Test message sent successfully',
        result: {
          messageName: result.name,
          createTime: result.createTime,
          sender: result.sender.displayName,
        },
      });

    } catch (error) {
      console.error('Error sending test message:', error);
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to send test message',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in test message API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}