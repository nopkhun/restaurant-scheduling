'use client';

import { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { Schedule } from '@/types/schedule';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfMonth, endOfMonth, getDate } from 'date-fns';

interface CalendarViewProps {
  schedules: Schedule[];
  onCreateSchedule?: (date: Date) => void;
  onEditSchedule?: (schedule: Schedule) => void;
  loading?: boolean;
  viewMode?: 'week' | 'month';
}

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
}

export function CalendarView({ 
  schedules = [], 
  onCreateSchedule, 
  onEditSchedule, 
  loading = false,
  viewMode = 'week'
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { getUserRole } = useAuth();
  const userRole = getUserRole();

  const canCreateSchedules = userRole === 'manager' || userRole === 'admin';

  // Navigation functions
  const navigatePrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  // Get date range for current view
  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }), // Monday start
        end: endOfWeek(currentDate, { weekStartsOn: 1 })
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      };
    }
  }, [currentDate, viewMode]);

  // Get days to display
  const displayDays = useMemo(() => {
    if (viewMode === 'week') {
      return eachDayOfInterval(dateRange);
    } else {
      // For month view, we need to include days from previous/next month to fill the grid
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }
  }, [currentDate, viewMode, dateRange]);

  // Filter schedules for current view
  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
      const scheduleDate = new Date(schedule.shift_date);
      return scheduleDate >= dateRange.start && scheduleDate <= dateRange.end;
    });
  }, [schedules, dateRange]);

  // Group schedules by date
  const schedulesByDate = useMemo(() => {
    const groups: Record<string, ScheduleWithDetails[]> = {};
    filteredSchedules.forEach(schedule => {
      const dateKey = format(new Date(schedule.shift_date), 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(schedule as ScheduleWithDetails);
    });

    // Sort schedules by start time
    Object.keys(groups).forEach(dateKey => {
      groups[dateKey].sort((a, b) => a.start_time.localeCompare(b.start_time));
    });

    return groups;
  }, [filteredSchedules]);

  const formatTimeRange = (startTime: string, endTime: string) => {
    return `${startTime} - ${endTime}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'published':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderScheduleCard = (schedule: ScheduleWithDetails) => (
    <Card 
      key={schedule.id} 
      className="mb-2 p-2 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onEditSchedule?.(schedule)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <User className="h-3 w-3 text-gray-500" />
            <span className="text-sm font-medium truncate">
              {schedule.employee?.full_name || 'Unknown Employee'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Clock className="h-3 w-3" />
            <span>{formatTimeRange(schedule.start_time, schedule.end_time)}</span>
          </div>
          {schedule.notes && (
            <p className="text-xs text-gray-500 mt-1 truncate" title={schedule.notes}>
              {schedule.notes}
            </p>
          )}
        </div>
        <Badge className={`text-xs ${getStatusColor(schedule.status)}`}>
          {schedule.status}
        </Badge>
      </div>
    </Card>
  );

  const renderDayCell = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const daySchedules = schedulesByDate[dateKey] || [];
    const isToday = isSameDay(day, new Date());
    const isCurrentMonth = viewMode === 'week' || day.getMonth() === currentDate.getMonth();

    return (
      <div
        key={dateKey}
        className={`
          border border-gray-200 min-h-[120px] p-2
          ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
          ${isToday ? 'bg-blue-50 border-blue-200' : ''}
        `}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`
            text-sm font-medium
            ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
            ${isToday ? 'text-blue-600 font-bold' : ''}
          `}>
            {viewMode === 'week' ? format(day, 'EEE d') : getDate(day)}
          </span>
          {canCreateSchedules && isCurrentMonth && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onCreateSchedule?.(day);
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        <div className="space-y-1">
          {daySchedules.slice(0, viewMode === 'week' ? 10 : 3).map(renderScheduleCard)}
          {daySchedules.length > (viewMode === 'week' ? 10 : 3) && (
            <div className="text-xs text-gray-500 text-center py-1">
              +{daySchedules.length - (viewMode === 'week' ? 10 : 3)} more
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: viewMode === 'week' ? 7 : 35 }).map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {viewMode === 'week' 
              ? `Week of ${format(dateRange.start, 'MMM d, yyyy')}`
              : format(currentDate, 'MMMM yyyy')
            }
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={navigateToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={navigatePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === 'week' ? (
          <div className="grid grid-cols-7 gap-2">
            {displayDays.map(renderDayCell)}
          </div>
        ) : (
          <div>
            {/* Month view header */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>
            {/* Month view calendar */}
            <div className="grid grid-cols-7 gap-2 group">
              {displayDays.map(renderDayCell)}
            </div>
          </div>
        )}
        
        {filteredSchedules.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No schedules found for this {viewMode}</p>
            {canCreateSchedules && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => onCreateSchedule?.(currentDate)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Schedule
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}