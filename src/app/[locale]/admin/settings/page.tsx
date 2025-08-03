'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  Download,
  Upload,
  RotateCcw,
  Building,
  Clock,
  Calendar,
  DollarSign,
  Bell,
  Monitor,
  Shield,
  Briefcase,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface SystemSettings {
  // Company Information
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  company_logo_url?: string;
  
  // Time and Attendance Settings
  default_work_hours?: number;
  overtime_threshold?: number;
  break_duration_minutes?: number;
  clock_in_grace_period_minutes?: number;
  location_verification_radius_meters?: number;
  require_location_verification?: boolean;
  
  // Leave Settings
  annual_leave_days?: number;
  sick_leave_days?: number;
  personal_leave_days?: number;
  leave_approval_required?: boolean;
  advance_notice_days?: number;
  
  // Payroll Settings
  pay_frequency?: string;
  currency?: string;
  tax_rate_percentage?: number;
  social_security_rate_percentage?: number;
  social_security_max_amount?: number;
  minimum_wage?: number;
  
  // Notification Settings
  email_notifications_enabled?: boolean;
  sms_notifications_enabled?: boolean;
  google_chat_notifications_enabled?: boolean;
  notification_sender_email?: string;
  
  // System Settings
  default_timezone?: string;
  date_format?: string;
  time_format?: string;
  language?: string;
  maintenance_mode?: boolean;
  
  // Security Settings
  password_min_length?: number;
  password_require_uppercase?: boolean;
  password_require_lowercase?: boolean;
  password_require_numbers?: boolean;
  password_require_symbols?: boolean;
  session_timeout_minutes?: number;
  max_login_attempts?: number;
  
  // Business Settings
  business_hours_start?: string;
  business_hours_end?: string;
  days_of_operation?: string[];
  holiday_schedule_enabled?: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({});
  const [originalSettings, setOriginalSettings] = useState<SystemSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const { user } = useAuth();
  const t = useTranslations();

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    // Check if there are changes
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || {});
        setOriginalSettings(data.settings || {});
        setLastUpdated(data.last_updated || '');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(data.message);
        setOriginalSettings(settings);
        setHasChanges(false);
        setLastUpdated(new Date().toISOString());
      } else {
        toast.error(data.error || 'Failed to save settings');
        if (data.errors && data.errors.length > 0) {
          data.errors.forEach((error: string) => toast.error(error));
        }
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reset_to_defaults' }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(data.message);
        loadSettings(); // Reload settings
      } else {
        toast.error(data.error || 'Failed to reset settings');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      toast.error('Failed to reset settings');
    }
  };

  const exportSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'export_settings' }),
      });

      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `system-settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Settings exported successfully');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to export settings');
      }
    } catch (error) {
      console.error('Error exporting settings:', error);
      toast.error('Failed to export settings');
    }
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);
        
        if (importData.settings) {
          const response = await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              action: 'import_settings', 
              settings: importData.settings 
            }),
          });

          const data = await response.json();
          if (response.ok) {
            toast.success(data.message);
            loadSettings(); // Reload settings
          } else {
            toast.error(data.error || 'Failed to import settings');
          }
        } else {
          toast.error('Invalid settings file format');
        }
      } catch (error) {
        console.error('Error importing settings:', error);
        toast.error('Failed to parse settings file');
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
  };

  const updateSetting = (key: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('th-TH');
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          <span className="ml-4 text-lg">Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            System Settings
          </h1>
          <p className="text-gray-600">Configure system-wide settings and preferences</p>
          {lastUpdated && (
            <p className="text-sm text-gray-500">
              Last updated: {formatDateTime(lastUpdated)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".json"
            onChange={importSettings}
            className="hidden"
            id="import-settings"
          />
          <Button variant="outline" onClick={() => document.getElementById('import-settings')?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={exportSettings}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={loadSettings} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={saveSettings} disabled={!hasChanges || saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Changes Alert */}
      {hasChanges && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Click "Save Changes" to apply them.
          </AlertDescription>
        </Alert>
      )}

      {/* Maintenance Mode Alert */}
      {settings.maintenance_mode && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Maintenance Mode is enabled.</strong> The system is currently in maintenance mode and may not be accessible to regular users.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="company" className="flex items-center gap-1">
            <Building className="h-4 w-4" />
            Company
          </TabsTrigger>
          <TabsTrigger value="time" className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Time & Attendance
          </TabsTrigger>
          <TabsTrigger value="leave" className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Leave
          </TabsTrigger>
          <TabsTrigger value="payroll" className="flex items-center gap-1">
            <DollarSign className="h-4 w-4" />
            Payroll
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-1">
            <Monitor className="h-4 w-4" />
            System
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-1">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="business" className="flex items-center gap-1">
            <Briefcase className="h-4 w-4" />
            Business
          </TabsTrigger>
        </TabsList>

        {/* Company Settings */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={settings.company_name || ''}
                    onChange={(e) => updateSetting('company_name', e.target.value)}
                    placeholder="Your Company Name"
                  />
                </div>
                <div>
                  <Label htmlFor="company_email">Company Email</Label>
                  <Input
                    id="company_email"
                    type="email"
                    value={settings.company_email || ''}
                    onChange={(e) => updateSetting('company_email', e.target.value)}
                    placeholder="info@company.com"
                  />
                </div>
                <div>
                  <Label htmlFor="company_phone">Company Phone</Label>
                  <Input
                    id="company_phone"
                    value={settings.company_phone || ''}
                    onChange={(e) => updateSetting('company_phone', e.target.value)}
                    placeholder="+66 2 123 4567"
                  />
                </div>
                <div>
                  <Label htmlFor="company_logo_url">Company Logo URL</Label>
                  <Input
                    id="company_logo_url"
                    value={settings.company_logo_url || ''}
                    onChange={(e) => updateSetting('company_logo_url', e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="company_address">Company Address</Label>
                <Textarea
                  id="company_address"
                  value={settings.company_address || ''}
                  onChange={(e) => updateSetting('company_address', e.target.value)}
                  placeholder="Full company address"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time & Attendance Settings */}
        <TabsContent value="time" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time & Attendance Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="default_work_hours">Default Work Hours per Day</Label>
                  <Input
                    id="default_work_hours"
                    type="number"
                    min="1"
                    max="24"
                    value={settings.default_work_hours || ''}
                    onChange={(e) => updateSetting('default_work_hours', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="overtime_threshold">Overtime Threshold (hours/week)</Label>
                  <Input
                    id="overtime_threshold"
                    type="number"
                    min="0"
                    value={settings.overtime_threshold || ''}
                    onChange={(e) => updateSetting('overtime_threshold', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="break_duration_minutes">Break Duration (minutes)</Label>
                  <Input
                    id="break_duration_minutes"
                    type="number"
                    min="0"
                    value={settings.break_duration_minutes || ''}
                    onChange={(e) => updateSetting('break_duration_minutes', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="clock_in_grace_period_minutes">Clock-in Grace Period (minutes)</Label>
                  <Input
                    id="clock_in_grace_period_minutes"
                    type="number"
                    min="0"
                    value={settings.clock_in_grace_period_minutes || ''}
                    onChange={(e) => updateSetting('clock_in_grace_period_minutes', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="location_verification_radius_meters">Location Verification Radius (meters)</Label>
                  <Input
                    id="location_verification_radius_meters"
                    type="number"
                    min="0"
                    value={settings.location_verification_radius_meters || ''}
                    onChange={(e) => updateSetting('location_verification_radius_meters', parseInt(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="require_location_verification"
                  checked={settings.require_location_verification || false}
                  onCheckedChange={(checked) => updateSetting('require_location_verification', checked)}
                />
                <Label htmlFor="require_location_verification">Require location verification for clock in/out</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Settings */}
        <TabsContent value="leave" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Leave Management Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="annual_leave_days">Annual Leave Days</Label>
                  <Input
                    id="annual_leave_days"
                    type="number"
                    min="0"
                    value={settings.annual_leave_days || ''}
                    onChange={(e) => updateSetting('annual_leave_days', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="sick_leave_days">Sick Leave Days</Label>
                  <Input
                    id="sick_leave_days"
                    type="number"
                    min="0"
                    value={settings.sick_leave_days || ''}
                    onChange={(e) => updateSetting('sick_leave_days', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="personal_leave_days">Personal Leave Days</Label>
                  <Input
                    id="personal_leave_days"
                    type="number"
                    min="0"
                    value={settings.personal_leave_days || ''}
                    onChange={(e) => updateSetting('personal_leave_days', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="advance_notice_days">Advance Notice Required (days)</Label>
                  <Input
                    id="advance_notice_days"
                    type="number"
                    min="0"
                    value={settings.advance_notice_days || ''}
                    onChange={(e) => updateSetting('advance_notice_days', parseInt(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="leave_approval_required"
                  checked={settings.leave_approval_required || false}
                  onCheckedChange={(checked) => updateSetting('leave_approval_required', checked)}
                />
                <Label htmlFor="leave_approval_required">Require approval for leave requests</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Settings */}
        <TabsContent value="payroll" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payroll Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pay_frequency">Pay Frequency</Label>
                  <Select value={settings.pay_frequency || ''} onValueChange={(value) => updateSetting('pay_frequency', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi_weekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={settings.currency || ''} onValueChange={(value) => updateSetting('currency', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="THB">THB (Thai Baht)</SelectItem>
                      <SelectItem value="USD">USD (US Dollar)</SelectItem>
                      <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tax_rate_percentage">Tax Rate (%)</Label>
                  <Input
                    id="tax_rate_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={settings.tax_rate_percentage || ''}
                    onChange={(e) => updateSetting('tax_rate_percentage', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="social_security_rate_percentage">Social Security Rate (%)</Label>
                  <Input
                    id="social_security_rate_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={settings.social_security_rate_percentage || ''}
                    onChange={(e) => updateSetting('social_security_rate_percentage', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="social_security_max_amount">Social Security Max Amount</Label>
                  <Input
                    id="social_security_max_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.social_security_max_amount || ''}
                    onChange={(e) => updateSetting('social_security_max_amount', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="minimum_wage">Minimum Wage (per hour)</Label>
                  <Input
                    id="minimum_wage"
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.minimum_wage || ''}
                    onChange={(e) => updateSetting('minimum_wage', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="email_notifications_enabled"
                    checked={settings.email_notifications_enabled || false}
                    onCheckedChange={(checked) => updateSetting('email_notifications_enabled', checked)}
                  />
                  <Label htmlFor="email_notifications_enabled">Enable email notifications</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sms_notifications_enabled"
                    checked={settings.sms_notifications_enabled || false}
                    onCheckedChange={(checked) => updateSetting('sms_notifications_enabled', checked)}
                  />
                  <Label htmlFor="sms_notifications_enabled">Enable SMS notifications</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="google_chat_notifications_enabled"
                    checked={settings.google_chat_notifications_enabled || false}
                    onCheckedChange={(checked) => updateSetting('google_chat_notifications_enabled', checked)}
                  />
                  <Label htmlFor="google_chat_notifications_enabled">Enable Google Chat notifications</Label>
                </div>
              </div>
              <div>
                <Label htmlFor="notification_sender_email">Notification Sender Email</Label>
                <Input
                  id="notification_sender_email"
                  type="email"
                  value={settings.notification_sender_email || ''}
                  onChange={(e) => updateSetting('notification_sender_email', e.target.value)}
                  placeholder="noreply@company.com"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                System Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="default_timezone">Default Timezone</Label>
                  <Select value={settings.default_timezone || ''} onValueChange={(value) => updateSetting('default_timezone', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Bangkok">Asia/Bangkok</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="date_format">Date Format</Label>
                  <Select value={settings.date_format || ''} onValueChange={(value) => updateSetting('date_format', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="time_format">Time Format</Label>
                  <Select value={settings.time_format || ''} onValueChange={(value) => updateSetting('time_format', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                      <SelectItem value="24h">24-hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="language">Default Language</Label>
                  <Select value={settings.language || ''} onValueChange={(value) => updateSetting('language', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="th">ไทย (Thai)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="maintenance_mode"
                  checked={settings.maintenance_mode || false}
                  onCheckedChange={(checked) => updateSetting('maintenance_mode', checked)}
                />
                <Label htmlFor="maintenance_mode">Enable maintenance mode</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="password_min_length">Minimum Password Length</Label>
                  <Input
                    id="password_min_length"
                    type="number"
                    min="6"
                    max="32"
                    value={settings.password_min_length || ''}
                    onChange={(e) => updateSetting('password_min_length', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="session_timeout_minutes">Session Timeout (minutes)</Label>
                  <Input
                    id="session_timeout_minutes"
                    type="number"
                    min="15"
                    max="1440"
                    value={settings.session_timeout_minutes || ''}
                    onChange={(e) => updateSetting('session_timeout_minutes', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="max_login_attempts">Max Login Attempts</Label>
                  <Input
                    id="max_login_attempts"
                    type="number"
                    min="1"
                    max="10"
                    value={settings.max_login_attempts || ''}
                    onChange={(e) => updateSetting('max_login_attempts', parseInt(e.target.value))}
                  />
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <Label>Password Requirements</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="password_require_uppercase"
                      checked={settings.password_require_uppercase || false}
                      onCheckedChange={(checked) => updateSetting('password_require_uppercase', checked)}
                    />
                    <Label htmlFor="password_require_uppercase">Require uppercase letters</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="password_require_lowercase"
                      checked={settings.password_require_lowercase || false}
                      onCheckedChange={(checked) => updateSetting('password_require_lowercase', checked)}
                    />
                    <Label htmlFor="password_require_lowercase">Require lowercase letters</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="password_require_numbers"
                      checked={settings.password_require_numbers || false}
                      onCheckedChange={(checked) => updateSetting('password_require_numbers', checked)}
                    />
                    <Label htmlFor="password_require_numbers">Require numbers</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="password_require_symbols"
                      checked={settings.password_require_symbols || false}
                      onCheckedChange={(checked) => updateSetting('password_require_symbols', checked)}
                    />
                    <Label htmlFor="password_require_symbols">Require symbols</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Settings */}
        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Business Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="business_hours_start">Business Hours Start</Label>
                  <Input
                    id="business_hours_start"
                    type="time"
                    value={settings.business_hours_start || ''}
                    onChange={(e) => updateSetting('business_hours_start', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="business_hours_end">Business Hours End</Label>
                  <Input
                    id="business_hours_end"
                    type="time"
                    value={settings.business_hours_end || ''}
                    onChange={(e) => updateSetting('business_hours_end', e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <Label>Days of Operation</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                    const isSelected = settings.days_of_operation?.includes(day) || false;
                    return (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={day}
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const currentDays = settings.days_of_operation || [];
                            if (checked) {
                              updateSetting('days_of_operation', [...currentDays, day]);
                            } else {
                              updateSetting('days_of_operation', currentDays.filter(d => d !== day));
                            }
                          }}
                        />
                        <Label htmlFor={day} className="capitalize">
                          {day}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="holiday_schedule_enabled"
                  checked={settings.holiday_schedule_enabled || false}
                  onCheckedChange={(checked) => updateSetting('holiday_schedule_enabled', checked)}
                />
                <Label htmlFor="holiday_schedule_enabled">Enable holiday schedule management</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}