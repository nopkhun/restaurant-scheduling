import { getGoogleChatClient } from './client';
import { ChatMessage, ChatCard } from './config';

export interface PayslipNotificationData {
  employeeEmail: string;
  employeeName: string;
  slipNumber: string;
  periodStart: string;
  periodEnd: string;
  netSalary: number;
  payslipUrl: string;
  dashboardUrl: string;
}

export interface BulkPayslipNotificationData {
  spaceName?: string;
  payslips: Array<{
    employeeName: string;
    slipNumber: string;
    netSalary: number;
  }>;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  totalEmployees: number;
}

export class PayslipNotificationService {
  private client = getGoogleChatClient();

  /**
   * Send individual payslip notification to employee
   */
  async sendPayslipNotification(data: PayslipNotificationData): Promise<{ success: boolean; error?: string }> {
    try {
      const message = this.createPayslipMessage(data);
      await this.client.sendDirectMessage(data.employeeEmail, message);
      
      return { success: true };
    } catch (error) {
      console.error('Error sending payslip notification:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send bulk payslip notifications to multiple employees
   */
  async sendBulkPayslipNotifications(notifications: PayslipNotificationData[]): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const notification of notifications) {
      try {
        const result = await this.sendPayslipNotification(notification);
        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push(`${notification.employeeName}: ${result.error}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${notification.employeeName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Send HR notification about payslip generation completion
   */
  async sendHRPayslipSummary(data: BulkPayslipNotificationData, spaceName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const message = this.createHRSummaryMessage(data);
      
      if (spaceName) {
        await this.client.sendMessage(spaceName, message);
      } else {
        // Send to default HR space or configured space
        const defaultSpace = process.env.GOOGLE_CHAT_DEFAULT_SPACE;
        if (defaultSpace) {
          await this.client.sendMessage(defaultSpace, message);
        } else {
          throw new Error('No HR space configured for notifications');
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error sending HR payslip summary:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Create individual payslip notification message
   */
  private createPayslipMessage(data: PayslipNotificationData): ChatMessage {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 0,
      }).format(amount);
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const card: ChatCard = {
      header: {
        title: '💰 New Payslip Available',
        subtitle: `Pay Period: ${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`,
        imageType: 'CIRCLE',
      },
      sections: [
        {
          header: 'Payslip Details',
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
                topLabel: 'Slip Number',
                content: data.slipNumber,
                contentMultiline: false,
              },
            },
            {
              keyValue: {
                topLabel: 'Net Salary',
                content: formatCurrency(data.netSalary),
                contentMultiline: false,
                icon: 'DOLLAR',
              },
            },
            {
              keyValue: {
                topLabel: 'Pay Period',
                content: `${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`,
                contentMultiline: false,
                icon: 'CLOCK',
              },
            },
          ],
        },
        {
          widgets: [
            {
              buttons: [
                {
                  textButton: {
                    text: '📄 View Payslip',
                    onClick: {
                      openLink: {
                        url: data.payslipUrl,
                      },
                    },
                  },
                },
                {
                  textButton: {
                    text: '🏠 Open Dashboard',
                    onClick: {
                      openLink: {
                        url: data.dashboardUrl,
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          widgets: [
            {
              textParagraph: {
                text: '💡 <b>Reminder:</b> Please review your payslip carefully. If you notice any discrepancies, contact HR immediately.',
              },
            },
          ],
        },
      ],
    };

    return {
      text: `💰 Hi ${data.employeeName}! Your payslip for ${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)} is now available. Net pay: ${formatCurrency(data.netSalary)}`,
      cards: [card],
    };
  }

  /**
   * Create HR summary message for bulk payslip generation
   */
  private createHRSummaryMessage(data: BulkPayslipNotificationData): ChatMessage {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 0,
      }).format(amount);
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const card: ChatCard = {
      header: {
        title: '📊 Payslips Generated & Distributed',
        subtitle: `Pay Period: ${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`,
        imageType: 'SQUARE',
      },
      sections: [
        {
          header: 'Summary',
          widgets: [
            {
              keyValue: {
                topLabel: 'Total Employees',
                content: data.totalEmployees.toString(),
                contentMultiline: false,
                icon: 'PERSON',
              },
            },
            {
              keyValue: {
                topLabel: 'Total Payroll Amount',
                content: formatCurrency(data.totalAmount),
                contentMultiline: false,
                icon: 'DOLLAR',
              },
            },
            {
              keyValue: {
                topLabel: 'Pay Period',
                content: `${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`,
                contentMultiline: false,
                icon: 'CLOCK',
              },
            },
            {
              keyValue: {
                topLabel: 'Generation Time',
                content: new Date().toLocaleString('th-TH'),
                contentMultiline: false,
                icon: 'CLOCK',
              },
            },
          ],
        },
      ],
    };

    // Add employee details if there are few enough to display
    if (data.payslips.length <= 10) {
      const employeeWidgets = data.payslips.map(payslip => ({
        keyValue: {
          topLabel: payslip.employeeName,
          content: `${payslip.slipNumber} - ${formatCurrency(payslip.netSalary)}`,
          contentMultiline: false,
        },
      }));

      card.sections.push({
        header: 'Employee Details',
        widgets: employeeWidgets,
      });
    } else {
      card.sections.push({
        widgets: [
          {
            textParagraph: {
              text: `📋 <b>${data.payslips.length} payslips</b> have been generated and distributed to employees.`,
            },
          },
        ],
      });
    }

    return {
      text: `📊 Payslip distribution complete! Generated ${data.totalEmployees} payslips totaling ${formatCurrency(data.totalAmount)} for the period ${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}.`,
      cards: [card],
    };
  }

  /**
   * Send payslip reminder notification
   */
  async sendPayslipReminder(data: PayslipNotificationData): Promise<{ success: boolean; error?: string }> {
    try {
      const message: ChatMessage = {
        text: `📢 Reminder: You have an unviewed payslip available for the period ${new Date(data.periodStart).toLocaleDateString('th-TH')} - ${new Date(data.periodEnd).toLocaleDateString('th-TH')}. Please review it when convenient.`,
        cards: [{
          sections: [{
            widgets: [
              {
                textParagraph: {
                  text: `💰 <b>Slip Number:</b> ${data.slipNumber}\n💵 <b>Net Pay:</b> ${new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(data.netSalary)}`,
                },
              },
              {
                buttons: [{
                  textButton: {
                    text: '📄 View Payslip',
                    onClick: {
                      openLink: {
                        url: data.payslipUrl,
                      },
                    },
                  },
                }],
              },
            ],
          }],
        }],
      };

      await this.client.sendDirectMessage(data.employeeEmail, message);
      return { success: true };
    } catch (error) {
      console.error('Error sending payslip reminder:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Test payslip notification (for admin testing)
   */
  async sendTestPayslipNotification(employeeEmail: string): Promise<{ success: boolean; error?: string }> {
    try {
      const testData: PayslipNotificationData = {
        employeeEmail,
        employeeName: 'Test Employee',
        slipNumber: 'TEST-001',
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
        netSalary: 25000,
        payslipUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payslips`,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      };

      const result = await this.sendPayslipNotification(testData);
      return result;
    } catch (error) {
      console.error('Error sending test payslip notification:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Singleton instance
let notificationService: PayslipNotificationService | null = null;

export const getPayslipNotificationService = (): PayslipNotificationService => {
  if (!notificationService) {
    notificationService = new PayslipNotificationService();
  }
  return notificationService;
};

export const clearPayslipNotificationService = (): void => {
  notificationService = null;
};