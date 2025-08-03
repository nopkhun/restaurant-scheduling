'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Clock, 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Timer,
  Navigation
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { verifyLocation, formatLocation, type LocationCoords } from '@/lib/location/utils';
import { format } from 'date-fns';

interface TimeClockComponentProps {
  todaySchedule: {
    id: string;
    start_time: string;
    end_time: string;
    branch?: {
      name: string;
      latitude?: number;
      longitude?: number;
      radius_meters: number;
    };
  } | null;
  activeEntry: {
    id: string;
    schedule_id: string;
    clock_in_time: string;
    clock_in_location: LocationCoords;
    clock_in_accuracy: number;
  } | null;
  coords: LocationCoords | null;
  accuracy: number | null;
  locationLoading: boolean;
  locationError: string | null;
  canClockIn: boolean;
  canClockOut: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  onRefreshLocation: () => void;
  workedTime: string;
}

export function TimeClockComponent({
  todaySchedule,
  activeEntry,
  coords,
  accuracy,
  locationLoading,
  locationError,
  canClockIn,
  canClockOut,
  onClockIn,
  onClockOut,
  onRefreshLocation,
  workedTime,
}: TimeClockComponentProps) {
  const [locationVerification, setLocationVerification] = useState<{
    verified: boolean;
    reason?: string;
    distance?: number;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);
  
  const t = useTranslations();

  // Verify location whenever coordinates change
  useEffect(() => {
    if (coords && accuracy && todaySchedule?.branch?.latitude && todaySchedule?.branch?.longitude) {
      verifyUserLocation();
    }
  }, [coords, accuracy, todaySchedule?.branch]);

  const verifyUserLocation = async () => {
    if (!coords || !accuracy || !todaySchedule?.branch?.latitude || !todaySchedule?.branch?.longitude) {
      return;
    }

    setVerifying(true);
    try {
      const branchLocation = {
        latitude: todaySchedule.branch.latitude,
        longitude: todaySchedule.branch.longitude,
      };

      const result = await verifyLocation(
        coords,
        accuracy,
        branchLocation,
        todaySchedule.branch.radius_meters
      );

      setLocationVerification(result);
    } catch (error) {
      console.error('Error verifying location:', error);
      setLocationVerification({
        verified: false,
        reason: 'VERIFICATION_ERROR',
      });
    } finally {
      setVerifying(false);
    }
  };

  const getLocationStatusBadge = () => {
    if (locationLoading || verifying) {
      return (
        <Badge variant="outline" className="text-yellow-600">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-600 mr-1" />
          Checking...
        </Badge>
      );
    }

    if (locationError) {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Location Error
        </Badge>
      );
    }

    if (!coords) {
      return (
        <Badge variant="outline" className="text-orange-600">
          <AlertTriangle className="h-3 w-3 mr-1" />
          No Location
        </Badge>
      );
    }

    if (!locationVerification) {
      return (
        <Badge variant="outline">
          <MapPin className="h-3 w-3 mr-1" />
          Checking...
        </Badge>
      );
    }

    if (locationVerification.verified) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      );
    }

    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Not Verified
      </Badge>
    );
  };

  const getLocationMessage = () => {
    if (locationError) {
      return {
        type: 'error' as const,
        message: locationError,
      };
    }

    if (!coords) {
      return {
        type: 'warning' as const,
        message: 'Location access is required for time tracking. Please enable location services.',
      };
    }

    if (!todaySchedule?.branch?.latitude || !todaySchedule?.branch?.longitude) {
      return {
        type: 'warning' as const,
        message: 'Branch location is not configured. Please contact your manager.',
      };
    }

    if (!locationVerification) {
      return null;
    }

    if (locationVerification.verified) {
      const distance = locationVerification.distance ? Math.round(locationVerification.distance) : 0;
      return {
        type: 'success' as const,
        message: `Location verified. You are ${distance}m from the workplace.`,
      };
    }

    let message = 'Location verification failed: ';
    switch (locationVerification.reason) {
      case 'GPS_ACCURACY_TOO_LOW':
        message += 'GPS accuracy is too low. Please move to an area with better signal.';
        break;
      case 'OUTSIDE_LOCATION_RADIUS':
        const distance = locationVerification.distance ? Math.round(locationVerification.distance) : 0;
        const radius = todaySchedule?.branch?.radius_meters || 50;
        message += `You are ${distance}m from the workplace (max allowed: ${radius}m).`;
        break;
      case 'IP_LOCATION_MISMATCH':
        message += 'Location verification failed. Please contact your manager.';
        break;
      default:
        message += 'Unknown error occurred.';
    }

    return {
      type: 'error' as const,
      message,
    };
  };

  const locationMessage = getLocationMessage();
  const isLocationVerified = locationVerification?.verified ?? false;

  // Calculate schedule progress
  const getScheduleProgress = () => {
    if (!todaySchedule || !activeEntry) return 0;
    
    const startTime = new Date(`${format(new Date(), 'yyyy-MM-dd')} ${todaySchedule.start_time}`);
    const endTime = new Date(`${format(new Date(), 'yyyy-MM-dd')} ${todaySchedule.end_time}`);
    const clockInTime = new Date(activeEntry.clock_in_time);
    const currentTime = new Date();
    
    const totalDuration = endTime.getTime() - startTime.getTime();
    const workedDuration = currentTime.getTime() - clockInTime.getTime();
    
    return Math.min((workedDuration / totalDuration) * 100, 100);
  };

  return (
    <div className="space-y-6">
      {/* Main Clock Card */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-6 w-6" />
              Time Clock
            </CardTitle>
            {getLocationStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Time and Status */}
          <div className="text-center">
            <div className="text-4xl font-mono font-bold text-gray-900 mb-2">
              {format(new Date(), 'HH:mm:ss')}
            </div>
            <div className="text-lg text-gray-600">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </div>
            
            {activeEntry && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-green-800 mb-2">
                  <Timer className="h-5 w-5" />
                  <span className="font-semibold">Currently Working</span>
                </div>
                <div className="text-2xl font-mono font-bold text-green-900">
                  {workedTime}
                </div>
                <div className="text-sm text-green-700 mt-1">
                  Started at {format(new Date(activeEntry.clock_in_time), 'HH:mm')}
                </div>
                
                {/* Schedule Progress */}
                {todaySchedule && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-green-700 mb-1">
                      <span>Progress</span>
                      <span>{Math.round(getScheduleProgress())}%</span>
                    </div>
                    <Progress value={getScheduleProgress()} className="h-2" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Location Information */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Location Information</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onRefreshLocation}
                disabled={locationLoading}
              >
                <RefreshCw className={`h-4 w-4 ${locationLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            {coords && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Your Location:</span>
                  <span className="font-mono">{formatLocation(coords, accuracy || undefined)}</span>
                </div>
                {todaySchedule?.branch && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Workplace:</span>
                    <span>{todaySchedule.branch.name}</span>
                  </div>
                )}
                {locationVerification?.distance && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Distance:</span>
                    <span>{Math.round(locationVerification.distance)}m</span>
                  </div>
                )}
              </div>
            )}

            {locationMessage && (
              <Alert className={`mt-3 ${
                locationMessage.type === 'success' ? 'border-green-200 bg-green-50' :
                locationMessage.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                'border-red-200 bg-red-50'
              }`}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className={
                  locationMessage.type === 'success' ? 'text-green-800' :
                  locationMessage.type === 'warning' ? 'text-yellow-800' :
                  'text-red-800'
                }>
                  {locationMessage.message}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Schedule Information */}
          {todaySchedule && (
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Today's Schedule</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Scheduled Time:</span>
                  <span className="font-mono">
                    {todaySchedule.start_time} - {todaySchedule.end_time}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span>{todaySchedule.branch?.name || 'Not specified'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Clock In/Out Buttons */}
          <div className="flex gap-4 justify-center">
            {!activeEntry ? (
              <Button
                size="lg"
                onClick={onClockIn}
                disabled={!canClockIn || !isLocationVerified}
                className="px-8 py-4 text-lg"
              >
                <Navigation className="h-5 w-5 mr-2" />
                Clock In
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="lg"
                onClick={onClockOut}
                disabled={!canClockOut || !isLocationVerified}
                className="px-8 py-4 text-lg"
              >
                <Clock className="h-5 w-5 mr-2" />
                Clock Out
              </Button>
            )}
          </div>

          {/* No Schedule Message */}
          {!todaySchedule && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-blue-800">
                You don't have any scheduled shifts for today. Please contact your manager if this is incorrect.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}