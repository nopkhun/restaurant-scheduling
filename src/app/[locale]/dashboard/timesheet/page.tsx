'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, MapPin, Calendar, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimeClockComponent } from '@/components/timesheet/time-clock';
import { TimeEntryList } from '@/components/timesheet/time-entry-list';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from '@/hooks/use-location';
import { TimeEntry, Schedule } from '@/types/schedule';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ActiveTimeEntry {
  id: string;
  schedule_id: string;
  clock_in_time: string;
  clock_in_location: {
    latitude: number;
    longitude: number;
  };
  clock_in_accuracy: number;
}

interface TodaySchedule extends Schedule {
  employee?: {
    full_name: string;
    employee_id: string;
  };
  branch?: {
    name: string;
    latitude?: number;
    longitude?: number;
    radius_meters: number;
  };
}

export default function TimesheetPage() {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<TodaySchedule | null>(null);
  const [activeEntry, setActiveEntry] = useState<ActiveTimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const { user, getUserRole } = useAuth();
  const { coords, accuracy, loading: locationLoading, error: locationError, getLocation } = useLocation();
  const t = useTranslations();
  const userRole = getUserRole();

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load initial data
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTimeEntries(),
        loadTodaySchedule(),
        loadActiveEntry(),
      ]);
    } catch (error) {
      console.error('Error loading timesheet data:', error);
      toast.error('Failed to load timesheet data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTimeEntries = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await fetch(`/api/timesheet/entries?start_date=${today}&end_date=${today}`);
      
      if (response.ok) {
        const data = await response.json();
        setTimeEntries(data.entries || []);
      }
    } catch (error) {
      console.error('Error loading time entries:', error);
    }
  };

  const loadTodaySchedule = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await fetch(`/api/schedules?employee_id=${user?.id}&start_date=${today}&end_date=${today}`);
      
      if (response.ok) {
        const data = await response.json();
        const schedule = data.schedules?.[0];
        setTodaySchedule(schedule || null);
      }
    } catch (error) {
      console.error('Error loading today schedule:', error);
    }
  };

  const loadActiveEntry = async () => {
    try {
      const response = await fetch('/api/timesheet/active');
      
      if (response.ok) {
        const data = await response.json();
        setActiveEntry(data.entry || null);
      }
    } catch (error) {
      console.error('Error loading active entry:', error);
    }
  };

  const handleClockIn = async () => {
    if (!todaySchedule || !coords) {
      toast.error('Location data or schedule information is missing');
      return;
    }

    try {
      const response = await fetch('/api/timesheet/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule_id: todaySchedule.id,
          location: {
            latitude: coords.latitude,
            longitude: coords.longitude,
          },
          accuracy: accuracy,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setActiveEntry(data.entry);
        await loadTimeEntries();
        toast.success('Clocked in successfully');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to clock in');
      }
    } catch (error) {
      console.error('Error clocking in:', error);
      toast.error('Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry || !coords) {
      toast.error('No active clock-in found or location data missing');
      return;
    }

    try {
      const response = await fetch('/api/timesheet/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entry_id: activeEntry.id,
          location: {
            latitude: coords.latitude,
            longitude: coords.longitude,
          },
          accuracy: accuracy,
        }),
      });

      if (response.ok) {
        setActiveEntry(null);
        await loadTimeEntries();
        toast.success('Clocked out successfully');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to clock out');
      }
    } catch (error) {
      console.error('Error clocking out:', error);
      toast.error('Failed to clock out');
    }
  };

  // Calculate worked time if actively clocked in
  const calculateWorkedTime = () => {
    if (!activeEntry) return '00:00:00';
    
    const startTime = new Date(activeEntry.clock_in_time);
    const duration = currentTime.getTime() - startTime.getTime();
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get location verification status
  const getLocationStatus = () => {
    if (locationLoading) return 'checking';
    if (locationError) return 'error';
    if (!coords) return 'unavailable';
    
    if (!todaySchedule?.branch?.latitude || !todaySchedule?.branch?.longitude) {
      return 'no-branch-location';
    }

    // We'll implement this verification in the TimeClockComponent
    return 'available';
  };

  const locationStatus = getLocationStatus();
  const canClockIn = !activeEntry && todaySchedule && coords && !locationLoading;
  const canClockOut = activeEntry && coords && !locationLoading;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Time Tracking</h1>
          <p className="text-gray-500 mt-1">
            Clock in and out with location verification
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold text-gray-900">
            {format(currentTime, 'HH:mm:ss')}
          </div>
          <div className="text-sm text-gray-500">
            {format(currentTime, 'EEEE, MMMM d, yyyy')}
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Status</p>
                <p className="text-xl font-bold text-gray-900">
                  {activeEntry ? 'Clocked In' : 'Clocked Out'}
                </p>
              </div>
              <div className={`p-2 rounded-full ${activeEntry ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Clock className={`h-6 w-6 ${activeEntry ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Worked Time Today */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Worked Time</p>
                <p className="text-xl font-mono font-bold text-gray-900">
                  {activeEntry ? calculateWorkedTime() : '00:00:00'}
                </p>
              </div>
              <div className="p-2 rounded-full bg-blue-100">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Location</p>
                <div className="flex items-center gap-2">
                  {locationStatus === 'checking' && (
                    <>
                      <Badge variant="outline" className="text-yellow-600">Checking</Badge>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600" />
                    </>
                  )}
                  {locationStatus === 'available' && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Available
                    </Badge>
                  )}
                  {locationStatus === 'error' && (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      Error
                    </Badge>
                  )}
                  {locationStatus === 'unavailable' && (
                    <Badge variant="outline" className="text-orange-600">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Unavailable
                    </Badge>
                  )}
                </div>
              </div>
              <div className="p-2 rounded-full bg-purple-100">
                <MapPin className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="clock" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="clock">Time Clock</TabsTrigger>
          <TabsTrigger value="entries">Time Entries</TabsTrigger>
        </TabsList>

        <TabsContent value="clock">
          <TimeClockComponent
            todaySchedule={todaySchedule}
            activeEntry={activeEntry}
            coords={coords}
            accuracy={accuracy}
            locationLoading={locationLoading}
            locationError={locationError}
            canClockIn={canClockIn}
            canClockOut={canClockOut}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
            onRefreshLocation={getLocation}
            workedTime={calculateWorkedTime()}
          />
        </TabsContent>

        <TabsContent value="entries">
          <TimeEntryList
            entries={timeEntries}
            loading={loading}
            onRefresh={loadTimeEntries}
            canEdit={userRole === 'manager' || userRole === 'admin'}
            userRole={userRole}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}