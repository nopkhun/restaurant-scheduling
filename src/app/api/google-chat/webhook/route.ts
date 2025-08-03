import { NextRequest, NextResponse } from 'next/server';
import { getGoogleChatWebhookHandler } from '@/lib/google-chat/webhook-handler';
import { ChatEvent } from '@/lib/google-chat/config';

export async function POST(request: NextRequest) {
  try {
    // Parse the incoming event
    const event: ChatEvent = await request.json();
    
    console.log('Received Google Chat webhook:', event.type);
    
    const handler = getGoogleChatWebhookHandler();
    
    // Validate the webhook request
    if (!handler.validateWebhookRequest(event)) {
      console.error('Invalid webhook request:', event);
      return NextResponse.json(
        { error: 'Invalid webhook request' },
        { status: 400 }
      );
    }

    // Process the event
    const response = await handler.handleWebhookEvent(event);
    
    // Return the response (or empty response if null)
    if (response) {
      return NextResponse.json(response);
    } else {
      return new NextResponse(null, { status: 200 });
    }

  } catch (error) {
    console.error('Error processing Google Chat webhook:', error);
    
    // Return a user-friendly error message
    return NextResponse.json({
      text: 'Sorry, I encountered an error processing your request. Please try again later.',
    }, { status: 200 }); // Return 200 to avoid Chat retries
  }
}

export async function GET(request: NextRequest) {
  // Health check endpoint
  return NextResponse.json({
    status: 'ok',
    service: 'Google Chat Webhook',
    timestamp: new Date().toISOString(),
  });
}