import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';
import { z } from 'zod';

const settingsSchema = z.object({
  // Company Information
  company_name: z.string().min(1, 'Company name is required').optional(),
  company_email: z.string().email('Invalid email').optional(),
  company_phone: z.string().optional(),
  company_address: z.string().optional(),
  company_logo_url: z.string().url('Invalid URL').optional(),
  
  // Time and Attendance Settings
  default_work_hours: z.number().min(0).max(24).optional(),
  overtime_threshold: z.number().min(0).optional(),
  break_duration_minutes: z.number().min(0).optional(),
  clock_in_grace_period_minutes: z.number().min(0).optional(),
  location_verification_radius_meters: z.number().min(0).optional(),
  require_location_verification: z.boolean().optional(),
  
  // Leave Settings
  annual_leave_days: z.number().min(0).optional(),
  sick_leave_days: z.number().min(0).optional(),
  personal_leave_days: z.number().min(0).optional(),
  leave_approval_required: z.boolean().optional(),
  advance_notice_days: z.number().min(0).optional(),
  
  // Payroll Settings
  pay_frequency: z.enum(['weekly', 'bi_weekly', 'monthly']).optional(),
  currency: z.string().min(3).max(3).optional(),
  tax_rate_percentage: z.number().min(0).max(100).optional(),
  social_security_rate_percentage: z.number().min(0).max(100).optional(),
  social_security_max_amount: z.number().min(0).optional(),
  minimum_wage: z.number().min(0).optional(),
  
  // Notification Settings
  email_notifications_enabled: z.boolean().optional(),
  sms_notifications_enabled: z.boolean().optional(),
  google_chat_notifications_enabled: z.boolean().optional(),
  notification_sender_email: z.string().email('Invalid email').optional(),
  
  // System Settings
  default_timezone: z.string().optional(),
  date_format: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
  time_format: z.enum(['12h', '24h']).optional(),
  language: z.enum(['en', 'th']).optional(),
  maintenance_mode: z.boolean().optional(),
  
  // Security Settings
  password_min_length: z.number().min(6).max(32).optional(),
  password_require_uppercase: z.boolean().optional(),
  password_require_lowercase: z.boolean().optional(),
  password_require_numbers: z.boolean().optional(),
  password_require_symbols: z.boolean().optional(),
  session_timeout_minutes: z.number().min(15).max(1440).optional(),
  max_login_attempts: z.number().min(1).max(10).optional(),
  
  // Business Settings
  business_hours_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  business_hours_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  days_of_operation: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(),
  holiday_schedule_enabled: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    
    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permissions - only admins can access system settings
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
        { error: 'Only administrators can access system settings' },
        { status: 403 }
      );
    }

    // Get system settings
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('*')
      .order('updated_at', { ascending: false });

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    // Convert array of settings to object with key-value pairs
    const settingsObject = settings?.reduce((acc: any, setting: any) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {}) || {};

    // Add metadata
    const settingsWithMeta = {
      settings: settingsObject,
      last_updated: settings?.[0]?.updated_at,
      total_settings: settings?.length || 0,
    };

    return NextResponse.json(settingsWithMeta);

  } catch (error) {
    console.error('Error in settings API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    
    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permissions - only admins can update system settings
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

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can update system settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = settingsSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues 
        }, 
        { status: 400 }
      );
    }

    const settingsData = validationResult.data;
    const updatedSettings = [];
    const errors = [];

    // Update each setting individually
    for (const [key, value] of Object.entries(settingsData)) {
      if (value !== undefined) {
        try {
          // Check if setting exists
          const { data: existingSetting } = await supabase
            .from('system_settings')
            .select('id')
            .eq('key', key)
            .single();

          let result;
          if (existingSetting) {
            // Update existing setting
            result = await supabase
              .from('system_settings')
              .update({
                value: value,
                updated_at: new Date().toISOString(),
                updated_by: profile.id,
              })
              .eq('key', key)
              .select()
              .single();
          } else {
            // Create new setting
            result = await supabase
              .from('system_settings')
              .insert({
                key,
                value,
                created_by: profile.id,
                updated_by: profile.id,
              })
              .select()
              .single();
          }

          if (result.error) {
            errors.push(`Failed to update ${key}: ${result.error.message}`);
          } else {
            updatedSettings.push(result.data);
          }
        } catch (error) {
          errors.push(`Error updating ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // Log the settings change
    await supabase
      .from('system_logs')
      .insert({
        action: 'settings_updated',
        details: {
          updated_settings: Object.keys(settingsData),
          updated_by: profile.full_name,
          timestamp: new Date().toISOString(),
        },
        user_id: profile.id,
      });

    if (errors.length > 0) {
      return NextResponse.json({
        message: `Updated ${updatedSettings.length} settings with ${errors.length} errors`,
        updated: updatedSettings.length,
        errors,
        settings: updatedSettings,
      }, { status: 207 }); // 207 Multi-Status
    }

    return NextResponse.json({
      message: `Successfully updated ${updatedSettings.length} settings`,
      updated: updatedSettings.length,
      settings: updatedSettings,
    });

  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    
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
      .select('role, id, full_name')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'reset_to_defaults':
        return await resetToDefaults(supabase, profile);
      case 'export_settings':
        return await exportSettings(supabase);
      case 'import_settings':
        return await importSettings(supabase, profile, body.settings);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in settings action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function resetToDefaults(supabase: any, profile: any) {
  const defaultSettings = {
    // Company defaults
    company_name: 'Restaurant Scheduling System',
    currency: 'THB',
    
    // Time and attendance defaults
    default_work_hours: 8,
    overtime_threshold: 40,
    break_duration_minutes: 60,
    clock_in_grace_period_minutes: 15,
    location_verification_radius_meters: 50,
    require_location_verification: true,
    
    // Leave defaults
    annual_leave_days: 10,
    sick_leave_days: 30,
    personal_leave_days: 3,
    leave_approval_required: true,
    advance_notice_days: 3,
    
    // Payroll defaults
    pay_frequency: 'monthly',
    tax_rate_percentage: 5,
    social_security_rate_percentage: 5,
    social_security_max_amount: 750,
    minimum_wage: 331,
    
    // System defaults
    default_timezone: 'Asia/Bangkok',
    date_format: 'DD/MM/YYYY',
    time_format: '24h',
    language: 'th',
    maintenance_mode: false,
    
    // Security defaults
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_lowercase: true,
    password_require_numbers: true,
    password_require_symbols: false,
    session_timeout_minutes: 480,
    max_login_attempts: 5,
    
    // Business defaults
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    days_of_operation: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    holiday_schedule_enabled: true,
  };

  try {
    // Delete all existing settings
    await supabase
      .from('system_settings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    // Insert default settings
    const settingsToInsert = Object.entries(defaultSettings).map(([key, value]) => ({
      key,
      value,
      created_by: profile.id,
      updated_by: profile.id,
    }));

    const { data, error } = await supabase
      .from('system_settings')
      .insert(settingsToInsert)
      .select();

    if (error) {
      throw error;
    }

    // Log the action
    await supabase
      .from('system_logs')
      .insert({
        action: 'settings_reset_to_defaults',
        details: {
          reset_by: profile.full_name,
          timestamp: new Date().toISOString(),
          settings_count: settingsToInsert.length,
        },
        user_id: profile.id,
      });

    return NextResponse.json({
      message: 'Settings reset to defaults successfully',
      settings: data,
    });

  } catch (error) {
    console.error('Error resetting settings:', error);
    return NextResponse.json(
      { error: 'Failed to reset settings' },
      { status: 500 }
    );
  }
}

async function exportSettings(supabase: any) {
  try {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value, updated_at')
      .order('key');

    if (error) {
      throw error;
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      version: '1.0',
      settings: settings?.reduce((acc: any, setting: any) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {}) || {},
    };

    return NextResponse.json(exportData);

  } catch (error) {
    console.error('Error exporting settings:', error);
    return NextResponse.json(
      { error: 'Failed to export settings' },
      { status: 500 }
    );
  }
}

async function importSettings(supabase: any, profile: any, importedSettings: any) {
  if (!importedSettings || typeof importedSettings !== 'object') {
    return NextResponse.json(
      { error: 'Invalid settings data' },
      { status: 400 }
    );
  }

  try {
    const updated = [];
    const errors = [];

    for (const [key, value] of Object.entries(importedSettings)) {
      try {
        const { data: existingSetting } = await supabase
          .from('system_settings')
          .select('id')
          .eq('key', key)
          .single();

        let result;
        if (existingSetting) {
          result = await supabase
            .from('system_settings')
            .update({
              value,
              updated_at: new Date().toISOString(),
              updated_by: profile.id,
            })
            .eq('key', key)
            .select()
            .single();
        } else {
          result = await supabase
            .from('system_settings')
            .insert({
              key,
              value,
              created_by: profile.id,
              updated_by: profile.id,
            })
            .select()
            .single();
        }

        if (result.error) {
          errors.push(`Failed to import ${key}: ${result.error.message}`);
        } else {
          updated.push(result.data);
        }
      } catch (error) {
        errors.push(`Error importing ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Log the action
    await supabase
      .from('system_logs')
      .insert({
        action: 'settings_imported',
        details: {
          imported_by: profile.full_name,
          timestamp: new Date().toISOString(),
          settings_count: Object.keys(importedSettings).length,
          successful: updated.length,
          failed: errors.length,
        },
        user_id: profile.id,
      });

    return NextResponse.json({
      message: `Imported ${updated.length} settings with ${errors.length} errors`,
      imported: updated.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Error importing settings:', error);
    return NextResponse.json(
      { error: 'Failed to import settings' },
      { status: 500 }
    );
  }
}