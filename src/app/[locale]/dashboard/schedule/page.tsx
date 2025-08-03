'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, Plus, Filter, Download, RefreshCw, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarView } from '@/components/schedule/calendar-view';
import { ScheduleForm } from '@/components/schedule/schedule-form';
import { DragDropBuilder } from '@/components/schedule/drag-drop-builder';
import { useAuth } from '@/hooks/use-auth';
import { Schedule } from '@/types/schedule';
import { toast } from 'sonner';
import { format, addDays, subDays, startOfWeek } from 'date-fns';

interface ScheduleWithDetails extends Schedule {
  employee?: {
    id: string;
    full_name: string;
    employee_id: string;
  };
  branch?: {
    id: string;
    name: string;
  };
  creator?: {
    id: string;
    full_name: string;
  };
}

interface Branch {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  full_name: string;
  employee_id: string;
}

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'calendar' | 'builder'>('calendar');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleWithDetails | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [initialDate, setInitialDate] = useState<Date | undefined>();

  const { user, getUserRole, getUserBranchId, canAccessBranch } = useAuth();
  const t = useTranslations();
  const userRole = getUserRole();
  const userBranchId = getUserBranchId();

  const canCreateSchedules = userRole === 'manager' || userRole === 'admin';
  const canViewAllBranches = userRole === 'admin';
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  // Load initial data
  useEffect(() => {
    loadData();
  }, [selectedBranch, selectedEmployee]);

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      await Promise.all([
        loadSchedules(),
        loadBranches(),
        loadEmployees(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  }, [user, selectedBranch, selectedEmployee]);

  const loadSchedules = async () => {
    try {
      const params = new URLSearchParams();
      
      // Add date range for current view (load a wider range for better UX)
      const today = new Date();
      const startDate = format(subDays(today, 30), 'yyyy-MM-dd');
      const endDate = format(addDays(today, 60), 'yyyy-MM-dd');
      params.append('start_date', startDate);
      params.append('end_date', endDate);

      // Add filters
      if (selectedBranch !== 'all') {
        params.append('branch_id', selectedBranch);
      } else if (userBranchId && !canViewAllBranches) {
        // If user is not admin, restrict to their branch
        params.append('branch_id', userBranchId);
      }

      if (selectedEmployee !== 'all') {
        params.append('employee_id', selectedEmployee);
      }

      const response = await fetch(`/api/schedules?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch schedules');
      }

      const data = await response.json();
      setSchedules(data.schedules || []);
    } catch (error) {
      console.error('Error loading schedules:', error);
      toast.error('Failed to load schedules');
    }
  };

  const loadBranches = async () => {
    try {
      const response = await fetch('/api/branches');
      
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches || []);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedBranch !== 'all') {
        params.append('branch_id', selectedBranch);
      } else if (userBranchId && !canViewAllBranches) {
        params.append('branch_id', userBranchId);
      }

      const response = await fetch(`/api/employees?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const handleCreateSchedule = (date?: Date) => {
    setInitialDate(date);
    setEditingSchedule(null);
    setShowScheduleForm(true);
  };

  const handleEditSchedule = (schedule: ScheduleWithDetails) => {
    setInitialDate(undefined);
    setEditingSchedule(schedule);
    setShowScheduleForm(true);
  };

  const handleCloseForm = () => {
    setShowScheduleForm(false);
    setEditingSchedule(null);
    setInitialDate(undefined);
  };

  const handleSubmitSchedule = async (formData: Record<string, unknown>) => {
    try {
      setFormLoading(true);

      const url = editingSchedule 
        ? `/api/schedules/${editingSchedule.id}`
        : '/api/schedules';

      const method = editingSchedule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save schedule');
      }

      const data = await response.json();
      
      // Update local state
      if (editingSchedule) {
        setSchedules(schedules.map(s => 
          s.id === editingSchedule.id ? data.schedule : s
        ));
        toast.success('Schedule updated successfully');
      } else {
        setSchedules([...schedules, data.schedule]);
        toast.success('Schedule created successfully');
      }

      handleCloseForm();
    } catch (error: unknown) {
      console.error('Error saving schedule:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save schedule';
      toast.error(errorMessage);
    } finally {
      setFormLoading(false);
    }
  };

  const handleBulkScheduleCreate = async (bulkSchedules: Record<string, unknown>[]) => {
    try {
      const results = await Promise.allSettled(
        bulkSchedules.map(scheduleData =>
          fetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scheduleData),
          }).then(res => res.json())
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (successful > 0) {
        toast.success(`${successful} schedules created successfully`);
        await loadData(); // Refresh the data
      }

      if (failed > 0) {
        toast.error(`${failed} schedules failed to create`);
      }
    } catch (error) {
      console.error('Error creating bulk schedules:', error);
      toast.error('Failed to create schedules');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete schedule');
      }

      setSchedules(schedules.filter(s => s.id !== scheduleId));
      toast.success('Schedule deleted successfully');
    } catch (error: unknown) {
      console.error('Error deleting schedule:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete schedule';
      toast.error(errorMessage);
    }
  };

  const filteredBranches = canViewAllBranches 
    ? branches 
    : branches.filter(branch => canAccessBranch(branch.id));

  // Calculate schedule statistics
  const stats = {
    total: schedules.length,
    published: schedules.filter(s => s.status === 'published').length,
    draft: schedules.filter(s => s.status === 'draft').length,
    completed: schedules.filter(s => s.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('Schedule.title')}</h1>
          <p className="text-gray-500 mt-1">
            {t('Schedule.description')}
          </p>
        </div>
        <div className="flex gap-2">
          {canCreateSchedules && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setActiveTab('builder')}
                className={activeTab === 'builder' ? 'bg-blue-50 border-blue-200' : ''}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Drag & Drop Builder
              </Button>
              <Button onClick={() => handleCreateSchedule()}>
                <Plus className="h-4 w-4 mr-2" />
                {t('Schedule.createSchedule')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('Statistics.totalSchedules')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Published</p>
                <p className="text-2xl font-bold text-green-600">{stats.published}</p>
              </div>
              <Badge className="bg-green-100 text-green-800">Published</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Draft</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.draft}</p>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">Draft</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-blue-600">{stats.completed}</p>
              </div>
              <Badge className="bg-blue-100 text-blue-800">Completed</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & View Options
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">View:</label>
              <Select value={viewMode} onValueChange={(value: 'week' | 'month') => setViewMode(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Week View</SelectItem>
                  <SelectItem value="month">Month View</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Branch Filter */}
            {filteredBranches.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Branch:</label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {filteredBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Employee Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Employee:</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name} ({employee.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'calendar' | 'builder')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t('Schedule.viewSchedule')}
          </TabsTrigger>
          <TabsTrigger value="builder" className="flex items-center gap-2" disabled={!canCreateSchedules}>
            <Wand2 className="h-4 w-4" />
            Builder
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <CalendarView
            schedules={schedules}
            onCreateSchedule={canCreateSchedules ? handleCreateSchedule : undefined}
            onEditSchedule={handleEditSchedule}
            loading={loading}
            viewMode={viewMode}
          />
        </TabsContent>

        <TabsContent value="builder">
          {canCreateSchedules && selectedBranch !== 'all' ? (
            <DragDropBuilder
              branchId={selectedBranch || userBranchId || ''}
              weekStart={currentWeekStart}
              onSaveSchedules={handleBulkScheduleCreate}
            />
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500">
                  <Wand2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Please select a specific branch to use the schedule builder</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Schedule Form Dialog */}
      <Dialog open={showScheduleForm} onOpenChange={handleCloseForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
            </DialogTitle>
          </DialogHeader>
          <ScheduleForm
            schedule={editingSchedule || undefined}
            initialDate={initialDate}
            onSubmit={handleSubmitSchedule}
            onCancel={handleCloseForm}
            loading={formLoading}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}