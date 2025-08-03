'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, User, Plus, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, eachDayOfInterval, endOfWeek } from 'date-fns';

interface Employee {
  id: string;
  full_name: string;
  employee_id: string;
  role: string;
}

interface ScheduleTemplate {
  id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  position: number;
  day_of_week: number; // 0 = Sunday, 1 = Monday, etc.
}

interface DragDropBuilderProps {
  branchId: string;
  weekStart: Date;
  onSaveSchedules: (schedules: Record<string, unknown>[]) => Promise<void>;
}

function SortableScheduleItem({ schedule, employee, onUpdate, onRemove }: {
  schedule: ScheduleTemplate;
  employee: Employee;
  onUpdate: (id: string, updates: Partial<ScheduleTemplate>) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations('Schedule');
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: schedule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="mb-2 cursor-move hover:shadow-md transition-shadow">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-sm">{employee.full_name}</span>
              <Badge variant="outline" className="text-xs">
                {employee.employee_id}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-gray-400" />
              <Input
                type="time"
                value={schedule.start_time}
                onChange={(e) => onUpdate(schedule.id, { start_time: e.target.value })}
                className="w-20 h-7 text-xs"
              />
              <span className="text-gray-400">-</span>
              <Input
                type="time"
                value={schedule.end_time}
                onChange={(e) => onUpdate(schedule.id, { end_time: e.target.value })}
                className="w-20 h-7 text-xs"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(schedule.id)}
                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
              >
                ×
              </Button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">{t('breakMinutes')}:</span>
            <Input
              type="number"
              min="0"
              max="480"
              value={schedule.break_minutes}
              onChange={(e) => onUpdate(schedule.id, { break_minutes: parseInt(e.target.value) || 0 })}
              className="w-16 h-6 text-xs"
            />
            <span className="text-xs text-gray-500">min</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DayColumn({ 
  date, 
  schedules, 
  employees, 
  onAddSchedule, 
  onUpdateSchedule, 
  onRemoveSchedule,
}: {
  date: Date;
  schedules: ScheduleTemplate[];
  employees: Employee[];
  onAddSchedule: (dayOfWeek: number) => void;
  onUpdateSchedule: (id: string, updates: Partial<ScheduleTemplate>) => void;
  onRemoveSchedule: (id: string) => void;
}) {
  const t = useTranslations();
  const dayOfWeek = date.getDay();
  const daySchedules = schedules
    .filter(s => s.day_of_week === dayOfWeek)
    .sort((a, b) => a.position - b.position);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = daySchedules.findIndex(s => s.id === active.id);
      const newIndex = daySchedules.findIndex(s => s.id === over?.id);

      const reorderedSchedules = arrayMove(daySchedules, oldIndex, newIndex);
      
      // Update positions
      reorderedSchedules.forEach((schedule, index) => {
        onUpdateSchedule(schedule.id, { position: index });
      });
    }
  };

  return (
    <div className="flex-1 min-w-0">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-center">
            {format(date, 'EEE')}
            <br />
            <span className="text-xs text-gray-500">{format(date, 'MMM d')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={daySchedules.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {daySchedules.map((schedule) => {
                const employee = employees.find(e => e.id === schedule.employee_id);
                if (!employee) return null;

                return (
                  <SortableScheduleItem
                    key={schedule.id}
                    schedule={schedule}
                    employee={employee}
                    onUpdate={onUpdateSchedule}
                    onRemove={onRemoveSchedule}
                  />
                );
              })}
            </SortableContext>
          </DndContext>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddSchedule(dayOfWeek)}
            className="w-full mt-2 h-8 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('Common.create')} {t('Schedule.schedule')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function DragDropBuilder({ branchId, weekStart, onSaveSchedules }: DragDropBuilderProps) {
  const t = useTranslations();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<ScheduleTemplate[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const weekDays = eachDayOfInterval({
    start: startOfWeek(weekStart, { weekStartsOn: 1 }),
    end: endOfWeek(weekStart, { weekStartsOn: 1 })
  });

  useEffect(() => {
    loadEmployees();
    loadExistingSchedules();
  }, [branchId, weekStart]);

  const loadEmployees = async () => {
    try {
      const response = await fetch(`/api/employees?branch_id=${branchId}`);
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingSchedules = async () => {
    try {
      const startDate = format(weekDays[0], 'yyyy-MM-dd');
      const endDate = format(weekDays[6], 'yyyy-MM-dd');
      
      const response = await fetch(
        `/api/schedules?branch_id=${branchId}&start_date=${startDate}&end_date=${endDate}`
      );
      
      if (response.ok) {
        const data = await response.json();
        // Convert existing schedules to template format
        const templates = data.schedules.map((schedule: Record<string, unknown>, index: number) => ({
          id: schedule.id || `temp-${Date.now()}-${index}`,
          employee_id: schedule.employee_id,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          break_minutes: schedule.break_minutes || 30,
          position: index,
          day_of_week: new Date(schedule.shift_date as string).getDay(),
        }));
        setSchedules(templates);
      }
    } catch (error) {
      console.error('Error loading existing schedules:', error);
    }
  };

  const addSchedule = (dayOfWeek: number) => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    const daySchedules = schedules.filter(s => s.day_of_week === dayOfWeek);
    const newSchedule: ScheduleTemplate = {
      id: `temp-${Date.now()}`,
      employee_id: selectedEmployee,
      start_time: '09:00',
      end_time: '17:00',
      break_minutes: 30,
      position: daySchedules.length,
      day_of_week: dayOfWeek,
    };

    setSchedules([...schedules, newSchedule]);
  };

  const updateSchedule = (id: string, updates: Partial<ScheduleTemplate>) => {
    setSchedules(schedules.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
  };

  const removeSchedule = (id: string) => {
    setSchedules(schedules.filter(s => s.id !== id));
  };

  const resetSchedules = () => {
    setSchedules([]);
  };

  const saveSchedules = async () => {
    try {
      setSaving(true);

      // Convert templates to actual schedules
      const schedulesToSave = schedules.map((template) => {
        const dayDate = weekDays[template.day_of_week === 0 ? 6 : template.day_of_week - 1];
        return {
          employee_id: template.employee_id,
          branch_id: branchId,
          shift_date: format(dayDate, 'yyyy-MM-dd'),
          start_time: template.start_time,
          end_time: template.end_time,
          break_minutes: template.break_minutes,
          status: 'published',
        };
      });

      await onSaveSchedules(schedulesToSave);
      toast.success(t('Schedule.scheduleCreated'));
    } catch (error) {
      console.error('Error saving schedules:', error);
      toast.error('Failed to save schedules');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="ml-2">{t('Common.loading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Drag & Drop {t('Schedule.title')} Builder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                {t('Schedule.employee')}:
              </label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder={t('Validation.invalidEmployee')} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name} ({employee.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveSchedules} disabled={saving || schedules.length === 0}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? t('Common.loading') : t('Common.save')} {t('Schedule.title')}
            </Button>
            <Button variant="outline" onClick={resetSchedules}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('Common.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Week View */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((date) => (
          <DayColumn
            key={format(date, 'yyyy-MM-dd')}
            date={date}
            schedules={schedules}
            employees={employees}
            onAddSchedule={addSchedule}
            onUpdateSchedule={updateSchedule}
            onRemoveSchedule={removeSchedule}
          />
        ))}
      </div>

      {/* Summary */}
      {schedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {t('Schedule.title')} Summary ({schedules.length} shifts)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 text-xs">
              {weekDays.map((date, index) => {
                const daySchedules = schedules.filter(s => 
                  s.day_of_week === (index === 6 ? 0 : index + 1)
                );
                return (
                  <div key={index} className="text-center">
                    <div className="font-medium">{format(date, 'EEE')}</div>
                    <div className="text-gray-500">{daySchedules.length} shifts</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}