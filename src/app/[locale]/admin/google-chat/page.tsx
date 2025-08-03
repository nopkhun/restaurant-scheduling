'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { 
  MessageSquare, 
  Settings, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Send,
  ExternalLink,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  error?: string;
  spaces?: number;
  url?: string;
}

interface TestResults {
  timestamp: string;
  tests: TestResult[];
  overall: {
    success: boolean;
    message: string;
    passed: number;
    total: number;
  };
}

export default function GoogleChatAdminPage() {
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [payslipTestType, setPayslipTestType] = useState<'individual' | 'reminder'>('individual');
  const [sendingPayslipTest, setSendingPayslipTest] = useState(false);
  const [configData, setConfigData] = useState({
    projectId: '',
    webhookUrl: '',
    botToken: '',
    defaultSpace: '',
    serviceAccountKey: '',
  });

  const { user } = useAuth();
  const t = useTranslations();

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = () => {
    // Load current configuration from environment
    setConfigData({
      projectId: process.env.NEXT_PUBLIC_GOOGLE_CHAT_PROJECT_ID || '',
      webhookUrl: process.env.NEXT_PUBLIC_GOOGLE_CHAT_WEBHOOK_URL || '',
      botToken: '••••••••••••••••', // Masked for security
      defaultSpace: process.env.NEXT_PUBLIC_GOOGLE_CHAT_DEFAULT_SPACE || '',
      serviceAccountKey: '••••••••••••••••', // Masked for security
    });
  };

  const runTests = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/google-chat/test');
      if (response.ok) {
        const results = await response.json();
        setTestResults(results);
        if (results.overall.success) {
          toast.success('All Google Chat integration tests passed!');
        } else {
          toast.warning(`${results.overall.passed}/${results.overall.total} tests passed`);
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to run tests');
      }
    } catch (error) {
      console.error('Error running tests:', error);
      toast.error('Failed to run tests');
    } finally {
      setTesting(false);
    }
  };

  const sendTestMessage = async (type: 'default' | 'dm') => {
    if (type === 'dm' && !testRecipient.trim()) {
      toast.error('Please enter a recipient email for direct message test');
      return;
    }

    setSendingTest(true);
    try {
      const response = await fetch('/api/google-chat/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageType: type,
          recipient: type === 'dm' ? testRecipient : undefined,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('Test message sent successfully!');
      } else {
        toast.error(data.error || 'Failed to send test message');
      }
    } catch (error) {
      console.error('Error sending test message:', error);
      toast.error('Failed to send test message');
    } finally {
      setSendingTest(false);
    }
  };

  const sendTestPayslipNotification = async () => {
    if (!testRecipient.trim()) {
      toast.error('Please enter a recipient email for payslip notification test');
      return;
    }

    setSendingPayslipTest(true);
    try {
      const response = await fetch('/api/google-chat/test-payslip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientEmail: testRecipient,
          testType: payslipTestType,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast.success(`Test ${payslipTestType} notification sent successfully!`);
      } else {
        toast.error(data.error || 'Failed to send test payslip notification');
      }
    } catch (error) {
      console.error('Error sending test payslip notification:', error);
      toast.error('Failed to send test payslip notification');
    } finally {
      setSendingPayslipTest(false);
    }
  };

  const copyWebhookUrl = () => {
    const url = `${window.location.origin}/api/google-chat/webhook`;
    navigator.clipboard.writeText(url);
    toast.success('Webhook URL copied to clipboard');
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-5 w-5 text-green-600" />
    ) : (
      <XCircle className="h-5 w-5 text-red-600" />
    );
  };

  const getStatusBadge = (success: boolean) => {
    return success ? (
      <Badge className="bg-green-100 text-green-800">Passed</Badge>
    ) : (
      <Badge variant="destructive">Failed</Badge>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8" />
            Google Chat Integration
          </h1>
          <p className="text-gray-600">Configure and test Google Chat integration for automated notifications</p>
        </div>
        <Button onClick={runTests} disabled={testing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
          {testing ? 'Testing...' : 'Run Tests'}
        </Button>
      </div>

      <Tabs defaultValue="status" className="space-y-6">
        <TabsList>
          <TabsTrigger value="status">Status & Tests</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="testing">Send Test Messages</TabsTrigger>
          <TabsTrigger value="notifications">HR Notifications</TabsTrigger>
          <TabsTrigger value="documentation">Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-6">
          {/* Overall Status */}
          {testResults && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getStatusIcon(testResults.overall.success)}
                  Integration Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-medium">{testResults.overall.message}</p>
                    <p className="text-sm text-gray-600">
                      Last tested: {new Date(testResults.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {getStatusBadge(testResults.overall.success)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Test Results */}
          {testResults && (
            <Card>
              <CardHeader>
                <CardTitle>Test Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {testResults.tests.map((test, index) => (
                    <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
                      {getStatusIcon(test.success)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{test.name}</h4>
                          {getStatusBadge(test.success)}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{test.message}</p>
                        {test.error && (
                          <p className="text-sm text-red-600 mt-1">Error: {test.error}</p>
                        )}
                        {test.spaces !== undefined && (
                          <p className="text-sm text-blue-600 mt-1">Found {test.spaces} accessible spaces</p>
                        )}
                        {test.url && (
                          <p className="text-sm text-blue-600 mt-1">URL: {test.url}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start"
                  onClick={() => copyWebhookUrl()}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Copy className="h-4 w-4" />
                    Copy Webhook URL
                  </div>
                  <p className="text-sm text-gray-600 text-left">
                    Copy the webhook URL for Google Chat bot configuration
                  </p>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start"
                  onClick={() => window.open('https://console.cloud.google.com/apis/library/chat.googleapis.com', '_blank')}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ExternalLink className="h-4 w-4" />
                    Google Cloud Console
                  </div>
                  <p className="text-sm text-gray-600 text-left">
                    Open Google Cloud Console to manage Chat API settings
                  </p>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuration Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="projectId">Google Cloud Project ID</Label>
                  <Input
                    id="projectId"
                    value={configData.projectId}
                    onChange={(e) => setConfigData(prev => ({ ...prev, projectId: e.target.value }))}
                    placeholder="your-project-id"
                    disabled
                  />
                  <p className="text-xs text-gray-500">Set via GOOGLE_CHAT_PROJECT_ID environment variable</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="webhookUrl"
                      value={`${window.location.origin}/api/google-chat/webhook`}
                      disabled
                      className="flex-1"
                    />
                    <Button size="sm" variant="outline" onClick={copyWebhookUrl}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">Use this URL in your Google Chat bot configuration</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="botToken">Bot Token</Label>
                  <div className="flex gap-2">
                    <Input
                      id="botToken"
                      type={showApiKey ? 'text' : 'password'}
                      value={configData.botToken}
                      disabled
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">Set via GOOGLE_CHAT_BOT_TOKEN environment variable</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultSpace">Default Space</Label>
                  <Input
                    id="defaultSpace"
                    value={configData.defaultSpace}
                    onChange={(e) => setConfigData(prev => ({ ...prev, defaultSpace: e.target.value }))}
                    placeholder="spaces/AAAA..."
                    disabled
                  />
                  <p className="text-xs text-gray-500">Set via GOOGLE_CHAT_DEFAULT_SPACE environment variable</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceAccountKey">Service Account Key</Label>
                <Textarea
                  id="serviceAccountKey"
                  value={configData.serviceAccountKey}
                  disabled
                  className="h-20 font-mono text-xs"
                  placeholder="Service account key JSON"
                />
                <p className="text-xs text-gray-500">Set via GOOGLE_CHAT_SERVICE_ACCOUNT_KEY environment variable</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">Configuration Note</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Configuration values are set via environment variables for security. 
                      Contact your system administrator to update these values.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          {/* Basic Message Testing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Send Test Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Default Space Test</h4>
                  <p className="text-sm text-gray-600">
                    Send a test message to the configured default space.
                  </p>
                  <Button
                    onClick={() => sendTestMessage('default')}
                    disabled={sendingTest}
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send to Default Space
                  </Button>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Direct Message Test</h4>
                  <p className="text-sm text-gray-600">
                    Send a test direct message to a specific user.
                  </p>
                  <Input
                    placeholder="user@example.com"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                  />
                  <Button
                    onClick={() => sendTestMessage('dm')}
                    disabled={sendingTest || !testRecipient.trim()}
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Direct Message
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payslip Notification Testing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Test Payslip Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="payslip-recipient">Recipient Email</Label>
                    <Input
                      id="payslip-recipient"
                      placeholder="employee@example.com"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payslip-test-type">Notification Type</Label>
                    <Select value={payslipTestType} onValueChange={(value: 'individual' | 'reminder') => setPayslipTestType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual Payslip</SelectItem>
                        <SelectItem value="reminder">Payslip Reminder</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    {payslipTestType === 'individual' 
                      ? 'Send a test payslip notification with sample data to verify the notification format and delivery.'
                      : 'Send a test payslip reminder notification for employees who have not viewed their payslips.'
                    }
                  </p>
                </div>

                <Button
                  onClick={sendTestPayslipNotification}
                  disabled={sendingPayslipTest || !testRecipient.trim()}
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {sendingPayslipTest ? 'Sending...' : `Send Test ${payslipTestType === 'individual' ? 'Payslip' : 'Reminder'}`}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Testing Notes */}
          <Card>
            <CardContent className="p-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">Testing Notes</h4>
                    <ul className="text-sm text-blue-700 mt-1 space-y-1">
                      <li>• Ensure the bot has been added to the target space before testing</li>
                      <li>• Direct messages require the user to have interacted with the bot previously</li>
                      <li>• Test messages will include timestamp and sender information</li>
                      <li>• Payslip notifications use sample data and are marked as test notifications</li>
                      <li>• Test notifications do not affect actual payslip records</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          {/* HR Notification Types */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                HR Notification System
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      Schedule Updates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Automatic notifications when schedules are created, updated, or cancelled.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>New shift assignments</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span>Schedule changes</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>Shift cancellations</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5 text-purple-600" />
                      Time Tracking
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Reminders and alerts for clock in/out and attendance issues.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>Clock in reminders</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span>Clock out reminders</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>Missed clock outs</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-green-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-green-600" />
                      Leave Requests
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Updates on leave request submissions, approvals, and rejections.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>New requests to HR</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Approval notifications</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>Rejection notifications</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-orange-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                      System Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      System-wide announcements and maintenance notifications.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                        <span>Maintenance notices</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>Policy updates</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>General announcements</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-800">Automated Integration</h4>
                    <p className="text-sm text-green-700 mt-1">
                      These notifications are automatically triggered by system events. No manual configuration required once Google Chat is properly set up.
                    </p>
                    <ul className="text-sm text-green-700 mt-2 space-y-1">
                      <li>• Schedule creation/updates → Employee notifications</li>
                      <li>• Leave request submissions → HR notifications</li>
                      <li>• Payslip generation → Employee notifications</li>
                      <li>• Time tracking events → Reminder notifications</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Default HR Space</Label>
                    <Input
                      value={configData.defaultSpace}
                      disabled
                      placeholder="spaces/AAAA..."
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Space where HR notifications will be sent
                    </p>
                  </div>
                  <div>
                    <Label>Notification Status</Label>
                    <div className="mt-1 p-2 bg-gray-50 rounded border">
                      {testResults?.overall.success ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">Notifications enabled</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm">Notifications disabled</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose max-w-none">
                <h3>1. Google Cloud Console Setup</h3>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Create or select a Google Cloud project</li>
                  <li>Enable the Google Chat API</li>
                  <li>Create a service account with Chat API permissions</li>
                  <li>Download the service account key JSON file</li>
                </ol>

                <h3>2. Google Chat Bot Configuration</h3>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Go to Google Chat API configuration in Cloud Console</li>
                  <li>Set the bot name and description</li>
                  <li>Configure the webhook URL: <code>{window.location.origin}/api/google-chat/webhook</code></li>
                  <li>Set appropriate scopes and permissions</li>
                </ol>

                <h3>3. Environment Variables</h3>
                <p>Add these environment variables to your application:</p>
                <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm">
                  <div>GOOGLE_CHAT_PROJECT_ID=your-project-id</div>
                  <div>GOOGLE_CHAT_SERVICE_ACCOUNT_KEY='{`{"type": "service_account", ...}`}'</div>
                  <div>GOOGLE_CHAT_BOT_TOKEN=your-bot-token</div>
                  <div>GOOGLE_CHAT_WEBHOOK_URL={window.location.origin}/api/google-chat/webhook</div>
                  <div>GOOGLE_CHAT_DEFAULT_SPACE=spaces/AAAA... (optional)</div>
                </div>

                <h3>4. Testing</h3>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Use the "Run Tests" button to verify configuration</li>
                  <li>Send test messages to verify message delivery</li>
                  <li>Add the bot to spaces where notifications should be sent</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}