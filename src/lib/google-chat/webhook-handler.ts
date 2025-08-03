import { ChatEvent, ChatMessage } from './config';
import { getGoogleChatClient } from './client';

export interface WebhookResponse {
  text?: string;
  cards?: any[];
  actionResponse?: any;
}

export type ChatEventHandler = (event: ChatEvent) => Promise<WebhookResponse | null>;

export class GoogleChatWebhookHandler {
  private eventHandlers: Map<string, ChatEventHandler[]> = new Map();
  private client = getGoogleChatClient();

  /**
   * Register an event handler for specific event types
   */
  registerHandler(eventType: string, handler: ChatEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Process an incoming webhook event
   */
  async handleWebhookEvent(event: ChatEvent): Promise<WebhookResponse | null> {
    try {
      console.log('Processing Chat webhook event:', event.type);
      
      // Get handlers for this event type
      const handlers = this.eventHandlers.get(event.type) || [];
      
      // Process each handler
      for (const handler of handlers) {
        try {
          const response = await handler(event);
          if (response) {
            return response;
          }
        } catch (error) {
          console.error(`Error in webhook handler for ${event.type}:`, error);
        }
      }

      // Default responses for common events
      return this.getDefaultResponse(event);
    } catch (error) {
      console.error('Error processing webhook event:', error);
      return {
        text: 'Sorry, I encountered an error processing your request.',
      };
    }
  }

  /**
   * Get default responses for common events
   */
  private getDefaultResponse(event: ChatEvent): WebhookResponse | null {
    switch (event.type) {
      case 'ADDED_TO_SPACE':
        if (event.space?.type === 'ROOM') {
          return {
            text: `Hi everyone! 👋 I'm the Restaurant Scheduling Bot. I can help with:\n\n• Payslip notifications\n• Schedule updates\n• Leave request updates\n• Time tracking reminders\n\nType @RestaurantBot help for more information.`,
          };
        } else {
          return {
            text: `Hi there! 👋 I'm your Restaurant Scheduling assistant. I can help you with payslips, schedules, and notifications. Type "help" to see what I can do!`,
          };
        }

      case 'MESSAGE':
        if (event.message?.text) {
          const text = event.message.text.toLowerCase().trim();
          
          if (text.includes('help')) {
            return this.getHelpResponse();
          }
          
          if (text.includes('payslip') || text.includes('salary')) {
            return {
              text: 'To get information about your payslips, please use the web dashboard or I can send you notifications when new payslips are available.',
            };
          }
          
          if (text.includes('schedule')) {
            return {
              text: 'For schedule information, please check the web dashboard. I can notify you about schedule changes and reminders.',
            };
          }
        }
        
        return {
          text: 'I understand you\'re looking for help with restaurant scheduling. Type "help" to see available commands, or use the web dashboard for full functionality.',
        };

      case 'REMOVED_FROM_SPACE':
        // No response needed when removed
        return null;

      default:
        return null;
    }
  }

  /**
   * Get help response with available commands
   */
  private getHelpResponse(): WebhookResponse {
    return {
      cards: [{
        header: {
          title: '🤖 Restaurant Scheduling Bot',
          subtitle: 'Your HR and scheduling assistant',
        },
        sections: [{
          header: 'Available Commands',
          widgets: [
            {
              keyValue: {
                topLabel: '💰 Payslips',
                content: 'Get notified when new payslips are available',
                bottomLabel: 'Automatic notifications',
              },
            },
            {
              keyValue: {
                topLabel: '📅 Schedules',
                content: 'Receive schedule updates and reminders',
                bottomLabel: 'Real-time updates',
              },
            },
            {
              keyValue: {
                topLabel: '🏖️ Leave Requests',
                content: 'Get updates on leave request status',
                bottomLabel: 'Approval notifications',
              },
            },
            {
              keyValue: {
                topLabel: '⏰ Time Tracking',
                content: 'Reminders for clock in/out',
                bottomLabel: 'Location-based alerts',
              },
            },
            {
              buttons: [{
                textButton: {
                  text: '🌐 Open Dashboard',
                  onClick: {
                    openLink: {
                      url: process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.com',
                    },
                  },
                },
              }],
            },
          ],
        }],
      }],
    };
  }

  /**
   * Handle slash commands
   */
  async handleSlashCommand(event: ChatEvent, command: string, args: string[]): Promise<WebhookResponse | null> {
    switch (command) {
      case '/help':
        return this.getHelpResponse();

      case '/status':
        return {
          text: `🟢 Restaurant Scheduling Bot is online and ready to help!\n\nConnected to: ${process.env.NEXT_PUBLIC_APP_URL || 'Restaurant Scheduling System'}`,
        };

      case '/payslip':
        return {
          text: 'For payslip information, please visit the dashboard. I can send you notifications when new payslips are available.',
          cards: [{
            sections: [{
              widgets: [{
                buttons: [{
                  textButton: {
                    text: '📊 View Payslips',
                    onClick: {
                      openLink: {
                        url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/payslips`,
                      },
                    },
                  },
                }],
              }],
            }],
          }],
        };

      case '/schedule':
        return {
          text: 'Check your schedule on the dashboard. I can notify you about changes and upcoming shifts.',
          cards: [{
            sections: [{
              widgets: [{
                buttons: [{
                  textButton: {
                    text: '📅 View Schedule',
                    onClick: {
                      openLink: {
                        url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/schedule`,
                      },
                    },
                  },
                }],
              }],
            }],
          }],
        };

      default:
        return {
          text: `Unknown command: ${command}. Type "help" to see available commands.`,
        };
    }
  }

  /**
   * Validate webhook request (basic validation)
   */
  validateWebhookRequest(event: ChatEvent): boolean {
    try {
      // Basic validation - ensure required fields exist
      if (!event.type) {
        return false;
      }

      if (event.type === 'MESSAGE' && !event.message) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Webhook validation error:', error);
      return false;
    }
  }
}

// Singleton instance
let handlerInstance: GoogleChatWebhookHandler | null = null;

export const getGoogleChatWebhookHandler = (): GoogleChatWebhookHandler => {
  if (!handlerInstance) {
    handlerInstance = new GoogleChatWebhookHandler();
  }
  return handlerInstance;
};

export const clearGoogleChatWebhookHandler = (): void => {
  handlerInstance = null;
};