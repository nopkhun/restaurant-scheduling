'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, Clock, User, Building, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createScheduleSchema, updateScheduleSchema } from '@/lib/validations/schedule';
import { Schedule } from '@/types/schedule';
import { format } from 'date-fns';
import { z } from 'zod';

interface ScheduleFormProps {
  schedule?: Schedule;
  initialDate?: Date;
  onSubmit: (data: ScheduleFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

type ScheduleFormData = z.infer<typeof createScheduleSchema> | z.infer<typeof updateScheduleSchema>;

interface Employee {
  id: string;
  full_name: string;
  employee_id: string;
}

interface Branch {
  id: string;
  name: string;
}

export function ScheduleForm({ 
  schedule, 
  initialDate, 
  onSubmit, 
  onCancel, 
  loading = false 
}: ScheduleFormProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const isEditing = !!schedule;
  const schema = isEditing ? updateScheduleSchema : createScheduleSchema;

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      employee_id: schedule?.employee_id || '',
      branch_id: schedule?.branch_id || '',
      shift_date: schedule?.shift_date || (initialDate ? format(initialDate, 'yyyy-MM-dd') : ''),
      start_time: schedule?.start_time || '09:00',
      end_time: schedule?.end_time || '17:00',
      break_minutes: schedule?.break_minutes || 30,
      notes: schedule?.notes || '',
      ...(isEditing && { id: schedule.id }),
    },
  });

  // Load employees and branches
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);
        
        // Load employees
        const employeesResponse = await fetch('/api/employees');
        if (employeesResponse.ok) {
          const employeesData = await employeesResponse.json();
          setEmployees(employeesData.employees || []);
        }

        // Load branches
        const branchesResponse = await fetch('/api/branches');
        if (branchesResponse.ok) {
          const branchesData = await branchesResponse.json();
          setBranches(branchesData.branches || []);
        }
      } catch (error) {
        console.error('Error loading form data:', error);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, []);

  const handleSubmit = async (data: ScheduleFormData) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  // Generate time options (24-hour format)
  const timeOptions: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeOptions.push(timeString);
    }
  }

  if (loadingData) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading form data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          {isEditing ? 'Edit Schedule' : 'Create New Schedule'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Employee Selection */}
              <FormField
                control={form.control}
                name="employee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Employee
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.full_name} ({employee.employee_id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Branch Selection */}
              <FormField
                control={form.control}
                name="branch_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Branch
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a branch" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Shift Date */}
              <FormField
                control={form.control}
                name="shift_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      Shift Date
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Break Minutes */}
              <FormField
                control={form.control}
                name="break_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Break Minutes</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        max="480" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Start Time */}
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Start Time
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select start time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[200px]">
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Time */}
              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      End Time
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select end time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[200px]">
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notes (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any notes or special instructions..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Update Schedule' : 'Create Schedule'}
              </Button>
            </div>

            {/* Validation Summary */}
            {Object.keys(form.formState.errors).length > 0 && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">
                  Please correct the following errors:
                  <ul className="mt-2 list-disc list-inside">
                    {Object.entries(form.formState.errors).map(([field, error]) => (
                      <li key={field}>{error.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}