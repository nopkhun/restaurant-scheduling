import { getGoogleChatClient } from './client';
import { ChatMessage, ChatCard } from './config';

export interface ScheduleUpdateNotification {
  employeeName: string;
  employeeEmail: string;
  updateType: 'assigned' | 'changed' | 'cancelled';
  scheduleDate: string;
  startTime: string;
  endTime: string;
  position: string;
  updatedBy: string;
  reason?: string;
}

export interface LeaveRequestNotification {
  employeeName: string;
  employeeEmail: string;
  requestType: 'submitted' | 'approved' | 'rejected';
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  reviewedBy?: string;
  hrSpaceName?: string;
}

export interface TimeTrackingNotification {
  employeeName: string;
  employeeEmail: string;
  notificationType: 'clock_in_reminder' | 'clock_out_reminder' | 'missed_clock_out' | 'location_issue';
  shiftDate: string;
  shiftTime: string;
  location?: string;
  details?: string;
}

export interface SystemNotification {
  type: 'system_maintenance' | 'policy_update' | 'general_announcement';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetAudience: 'all' | 'employees' | 'hr' | 'managers';
  expiresAt?: string;
  actionRequired?: boolean;
  actionUrl?: string;
}

export class HRNotificationService {
  private client = getGoogleChatClient();

  /**
   * Send schedule update notifications
   */
  async sendScheduleUpdateNotification(data: ScheduleUpdateNotification): Promise<{ success: boolean; error?: string }> {
    try {
      const message = this.createScheduleUpdateMessage(data);
      await this.client.sendDirectMessage(data.employeeEmail, message);
      return { success: true };
    } catch (error) {
      console.error('Error sending schedule update notification:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send leave request notifications to employee and HR
   */
  async sendLeaveRequestNotification(data: LeaveRequestNotification): Promise<{ success: boolean; error?: string }> {
    try {
      // Send notification to employee
      const employeeMessage = this.createLeaveRequestEmployeeMessage(data);
      await this.client.sendDirectMessage(data.employeeEmail, employeeMessage);

      // Send notification to HR if specified and for certain request types
      if (data.hrSpaceName && ['submitted', 'approved', 'rejected'].includes(data.requestType)) {
        const hrMessage = this.createLeaveRequestHRMessage(data);
        await this.client.sendMessage(data.hrSpaceName, hrMessage);
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending leave request notification:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send time tracking notifications
   */
  async sendTimeTrackingNotification(data: TimeTrackingNotification): Promise<{ success: boolean; error?: string }> {
    try {
      const message = this.createTimeTrackingMessage(data);
      await this.client.sendDirectMessage(data.employeeEmail, message);
      return { success: true };
    } catch (error) {
      console.error('Error sending time tracking notification:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send system-wide notifications
   */
  async sendSystemNotification(data: SystemNotification, spaceName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const message = this.createSystemNotificationMessage(data);
      
      if (spaceName) {
        await this.client.sendMessage(spaceName, message);
      } else {
        // Send to default space
        const defaultSpace = process.env.GOOGLE_CHAT_DEFAULT_SPACE;
        if (defaultSpace) {
          await this.client.sendMessage(defaultSpace, message);
        } else {
          throw new Error('No space specified for system notification');
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending system notification:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Create schedule update message
   */
  private createScheduleUpdateMessage(data: ScheduleUpdateNotification): ChatMessage {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('th-TH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const getUpdateIcon = (type: string) => {
      switch (type) {
        case 'assigned': return '✅';
        case 'changed': return '🔄';
        case 'cancelled': return '❌';
        default: return '📅';
      }
    };

    const getUpdateText = (type: string) => {
      switch (type) {
        case 'assigned': return 'New shift assigned';
        case 'changed': return 'Shift updated';
        case 'cancelled': return 'Shift cancelled';
        default: return 'Schedule update';
      }
    };

    const card: ChatCard = {
      header: {
        title: `${getUpdateIcon(data.updateType)} Schedule Update`,
        subtitle: getUpdateText(data.updateType),
      },
      sections: [
        {
          header: 'Shift Details',
          widgets: [
            {
              keyValue: {
                topLabel: 'Date',
                content: formatDate(data.scheduleDate),
                contentMultiline: false,
                icon: 'CLOCK',
              },
            },
            {
              keyValue: {
                topLabel: 'Time',
                content: `${data.startTime} - ${data.endTime}`,
                contentMultiline: false,
                icon: 'CLOCK',
              },
            },
            {
              keyValue: {
                topLabel: 'Position',
                content: data.position,
                contentMultiline: false,
                icon: 'PERSON',
              },
            },
            {
              keyValue: {
                topLabel: 'Updated by',
                content: data.updatedBy,
                contentMultiline: false,
              },
            },
          ],
        },
      ],
    };

    if (data.reason) {
      card.sections.push({
        header: 'Reason',
        widgets: [
          {
            textParagraph: {
              text: data.reason,
            },
          },
        ],
      });
    }

    card.sections.push({
      widgets: [
        {
          buttons: [
            {
              textButton: {
                text: '📅 View Schedule',
                onClick: {
                  openLink: {
                    url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/schedule`,
                  },
                },
              },
            },
          ],
        },
      ],
    });

    return {
      text: `${getUpdateIcon(data.updateType)} Hi ${data.employeeName}! Your schedule has been updated. ${getUpdateText(data.updateType)} for ${formatDate(data.scheduleDate)} at ${data.startTime}-${data.endTime}.`,
      cards: [card],
    };
  }

  /**
   * Create leave request employee message
   */
  private createLeaveRequestEmployeeMessage(data: LeaveRequestNotification): ChatMessage {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const getStatusIcon = (type: string) => {
      switch (type) {
        case 'submitted': return '📝';
        case 'approved': return '✅';
        case 'rejected': return '❌';
        default: return '📋';
      }
    };

    const getStatusText = (type: string) => {
      switch (type) {
        case 'submitted': return 'Leave request submitted';
        case 'approved': return 'Leave request approved';
        case 'rejected': return 'Leave request rejected';
        default: return 'Leave request update';
      }
    };

    const card: ChatCard = {
      header: {
        title: `${getStatusIcon(data.requestType)} ${getStatusText(data.requestType)}`,
        subtitle: `${data.leaveType} leave`,
      },
      sections: [
        {
          header: 'Leave Details',
          widgets: [
            {
              keyValue: {
                topLabel: 'Leave Type',
                content: data.leaveType,
                contentMultiline: false,
              },
            },
            {
              keyValue: {
                topLabel: 'Duration',
                content: `${formatDate(data.startDate)} - ${formatDate(data.endDate)}`,
                contentMultiline: false,
                icon: 'CLOCK',
              },
            },
            {
              keyValue: {
                topLabel: 'Total Days',
                content: `${data.totalDays} days`,
                contentMultiline: false,
              },
            },
          ],
        },
      ],
    };

    if (data.reviewedBy) {
      card.sections[0].widgets.push({
        keyValue: {
          topLabel: 'Reviewed by',
          content: data.reviewedBy,
          contentMultiline: false,
        },
      });
    }

    if (data.reason) {
      card.sections.push({
        header: 'Reason',
        widgets: [
          {
            textParagraph: {
              text: data.reason,
            },
          },
        ],
      });
    }

    card.sections.push({
      widgets: [
        {
          buttons: [
            {
              textButton: {
                text: '📋 View Requests',
                onClick: {
                  openLink: {
                    url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/requests`,
                  },
                },
              },
            },
          ],
        },
      ],
    });

    return {
      text: `${getStatusIcon(data.requestType)} Hi ${data.employeeName}! Your ${data.leaveType} leave request for ${data.totalDays} days has been ${data.requestType === 'submitted' ? 'submitted' : data.requestType}.`,
      cards: [card],
    };
  }

  /**
   * Create leave request HR message
   */
  private createLeaveRequestHRMessage(data: LeaveRequestNotification): ChatMessage {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    if (data.requestType === 'submitted') {
      return {
        text: `📝 New leave request from ${data.employeeName}: ${data.leaveType} leave for ${data.totalDays} days (${formatDate(data.startDate)} - ${formatDate(data.endDate)})`,
        cards: [{
          header: {
            title: '📝 New Leave Request',
            subtitle: 'Requires approval',
          },
          sections: [{
            widgets: [
              {
                keyValue: {
                  topLabel: 'Employee',
                  content: data.employeeName,
                  contentMultiline: false,
                },
              },
              {
                keyValue: {
                  topLabel: 'Leave Type',
                  content: data.leaveType,
                  contentMultiline: false,
                },
              },
              {
                keyValue: {
                  topLabel: 'Duration',
                  content: `${formatDate(data.startDate)} - ${formatDate(data.endDate)} (${data.totalDays} days)`,
                  contentMultiline: false,
                },
              },
              {
                buttons: [{
                  textButton: {
                    text: '👀 Review Request',
                    onClick: {
                      openLink: {
                        url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/requests`,
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

    return {
      text: `${data.requestType === 'approved' ? '✅' : '❌'} Leave request ${data.requestType}: ${data.employeeName}'s ${data.leaveType} leave has been ${data.requestType} by ${data.reviewedBy || 'HR'}.`,
    };
  }

  /**
   * Create time tracking message
   */
  private createTimeTrackingMessage(data: TimeTrackingNotification): ChatMessage {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('th-TH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    };

    const getNotificationIcon = (type: string) => {
      switch (type) {
        case 'clock_in_reminder': return '🕐';
        case 'clock_out_reminder': return '🕕';
        case 'missed_clock_out': return '⚠️';
        case 'location_issue': return '📍';
        default: return '⏰';
      }
    };

    const getNotificationTitle = (type: string) => {
      switch (type) {
        case 'clock_in_reminder': return 'Clock In Reminder';
        case 'clock_out_reminder': return 'Clock Out Reminder';
        case 'missed_clock_out': return 'Missed Clock Out';
        case 'location_issue': return 'Location Verification Issue';
        default: return 'Time Tracking Alert';
      }
    };

    const getMessage = (type: string) => {
      switch (type) {
        case 'clock_in_reminder':
          return `Don't forget to clock in for your shift today at ${data.shiftTime}!`;
        case 'clock_out_reminder':
          return `Your shift ends at ${data.shiftTime}. Don't forget to clock out!`;
        case 'missed_clock_out':
          return `You may have forgotten to clock out from your shift that ended at ${data.shiftTime}.`;
        case 'location_issue':
          return `There was an issue verifying your location during clock in/out.`;
        default:
          return 'Time tracking notification';
      }
    };

    const card: ChatCard = {
      header: {
        title: `${getNotificationIcon(data.notificationType)} ${getNotificationTitle(data.notificationType)}`,
        subtitle: formatDate(data.shiftDate),
      },
      sections: [
        {
          widgets: [
            {
              keyValue: {
                topLabel: 'Date',
                content: formatDate(data.shiftDate),
                contentMultiline: false,
                icon: 'CLOCK',
              },
            },
            {
              keyValue: {
                topLabel: 'Time',
                content: data.shiftTime,
                contentMultiline: false,
                icon: 'CLOCK',
              },
            },
          ],
        },
      ],
    };

    if (data.location) {
      card.sections[0].widgets.push({
        keyValue: {
          topLabel: 'Location',
          content: data.location,
          contentMultiline: false,
          icon: 'MAP_PIN',
        },
      });
    }

    if (data.details) {
      card.sections.push({
        widgets: [
          {
            textParagraph: {
              text: data.details,
            },
          },
        ],
      });
    }

    card.sections.push({
      widgets: [
        {
          buttons: [
            {
              textButton: {
                text: '⏰ Open Timesheet',
                onClick: {
                  openLink: {
                    url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/timesheet`,
                  },
                },
              },
            },
          ],
        },
      ],
    });

    return {
      text: `${getNotificationIcon(data.notificationType)} Hi ${data.employeeName}! ${getMessage(data.notificationType)}`,
      cards: [card],
    };
  }

  /**
   * Create system notification message
   */
  private createSystemNotificationMessage(data: SystemNotification): ChatMessage {
    const getPriorityIcon = (priority: string) => {
      switch (priority) {
        case 'urgent': return '🚨';
        case 'high': return '⚠️';
        case 'medium': return 'ℹ️';
        case 'low': return '💬';
        default: return '📢';
      }
    };

    const getPriorityColor = (priority: string) => {
      switch (priority) {
        case 'urgent': return 'RED';
        case 'high': return 'YELLOW';
        case 'medium': return 'BLUE';
        case 'low': return 'GRAY';
        default: return 'BLUE';
      }
    };

    const card: ChatCard = {
      header: {
        title: `${getPriorityIcon(data.priority)} ${data.title}`,
        subtitle: `${data.priority.toUpperCase()} priority announcement`,
      },
      sections: [
        {
          widgets: [
            {
              textParagraph: {
                text: data.message,
              },
            },
            {
              keyValue: {
                topLabel: 'Priority',
                content: data.priority.toUpperCase(),
                contentMultiline: false,
              },
            },
            {
              keyValue: {
                topLabel: 'Target Audience',
                content: data.targetAudience.charAt(0).toUpperCase() + data.targetAudience.slice(1),
                contentMultiline: false,
              },
            },
          ],
        },
      ],
    };

    if (data.expiresAt) {
      card.sections[0].widgets.push({
        keyValue: {
          topLabel: 'Expires',
          content: new Date(data.expiresAt).toLocaleDateString('th-TH'),
          contentMultiline: false,
          icon: 'CLOCK',
        },
      });
    }

    if (data.actionRequired && data.actionUrl) {
      card.sections.push({
        widgets: [
          {
            buttons: [
              {
                textButton: {
                  text: '👆 Take Action',
                  onClick: {
                    openLink: {
                      url: data.actionUrl,
                    },
                  },
                },
              },
            ],
          },
        ],
      });
    }

    return {
      text: `${getPriorityIcon(data.priority)} **${data.title}**\n\n${data.message}`,
      cards: [card],
    };
  }
}

// Singleton instance
let hrNotificationService: HRNotificationService | null = null;

export const getHRNotificationService = (): HRNotificationService => {
  if (!hrNotificationService) {
    hrNotificationService = new HRNotificationService();
  }
  return hrNotificationService;
};

export const clearHRNotificationService = (): void => {
  hrNotificationService = null;
};