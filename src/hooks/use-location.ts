'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getCurrentLocation,
  verifyLocation,
  isLocationSupported,
  requestLocationPermission,
  LocationError,
  getLocationErrorMessage,
  type LocationCoords,
} from '@/lib/location/utils';

interface LocationState {
  coords: LocationCoords | null;
  accuracy: number | null;
  timestamp: number | null;
  loading: boolean;
  error: string | null;
  permission: PermissionState | null;
  supported: boolean;
}

interface UseLocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watchPosition?: boolean;
}

export function useLocation(options: UseLocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 30000,
    watchPosition = false,
  } = options;

  const [state, setState] = useState<LocationState>({
    coords: null,
    accuracy: null,
    timestamp: null,
    loading: false,
    error: null,
    permission: null,
    supported: isLocationSupported(),
  });

  const [watchId, setWatchId] = useState<number | null>(null);

  // Get current location
  const getLocation = useCallback(async () => {
    if (!state.supported) {
      setState(prev => ({ 
        ...prev, 
        error: getLocationErrorMessage(LocationError.NOT_SUPPORTED) 
      }));
      return null;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await getCurrentLocation();
      
      setState(prev => ({
        ...prev,
        coords: result.coords,
        accuracy: result.accuracy,
        timestamp: result.timestamp,
        loading: false,
        error: null,
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown location error';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      return null;
    }
  }, [state.supported]);

  // Verify location against branch location
  const verifyLocationAgainstBranch = useCallback(async (
    branchLocation: LocationCoords,
    radiusMeters: number = 50
  ) => {
    if (!state.coords || !state.accuracy) {
      throw new Error('No location data available. Please get location first.');
    }

    return await verifyLocation(
      state.coords,
      state.accuracy,
      branchLocation,
      radiusMeters
    );
  }, [state.coords, state.accuracy]);

  // Start watching position
  const startWatching = useCallback(() => {
    if (!state.supported || watchId !== null) return;

    const id = navigator.geolocation.watchPosition(
      (position) => {
        setState(prev => ({
          ...prev,
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          loading: false,
          error: null,
        }));
      },
      (error) => {
        let errorMessage = 'Unknown location error';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = getLocationErrorMessage(LocationError.PERMISSION_DENIED);
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = getLocationErrorMessage(LocationError.POSITION_UNAVAILABLE);
            break;
          case error.TIMEOUT:
            errorMessage = getLocationErrorMessage(LocationError.TIMEOUT);
            break;
        }
        setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );

    setWatchId(id);
  }, [state.supported, watchId, enableHighAccuracy, timeout, maximumAge]);

  // Stop watching position
  const stopWatching = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  // Check permission status
  const checkPermission = useCallback(async () => {
    const permission = await requestLocationPermission();
    setState(prev => ({ ...prev, permission }));
    return permission;
  }, []);

  // Clear location data
  const clearLocation = useCallback(() => {
    setState(prev => ({
      ...prev,
      coords: null,
      accuracy: null,
      timestamp: null,
      error: null,
    }));
  }, []);

  // Initialize permission check
  useEffect(() => {
    if (state.supported) {
      checkPermission();
    }
  }, [state.supported, checkPermission]);

  // Auto-start watching if enabled
  useEffect(() => {
    if (watchPosition && state.permission === 'granted') {
      startWatching();
    }

    return () => {
      if (watchPosition) {
        stopWatching();
      }
    };
  }, [watchPosition, state.permission, startWatching, stopWatching]);

  return {
    // Location data
    coords: state.coords,
    accuracy: state.accuracy,
    timestamp: state.timestamp,
    
    // Status
    loading: state.loading,
    error: state.error,
    permission: state.permission,
    supported: state.supported,
    watching: watchId !== null,
    
    // Helper properties
    hasLocation: !!state.coords,
    isAccurate: state.accuracy !== null && state.accuracy <= 100,
    
    // Methods
    getLocation,
    verifyLocationAgainstBranch,
    startWatching,
    stopWatching,
    checkPermission,
    clearLocation,
  };
}

/**
 * Simplified hook for one-time location getting
 */
export function useCurrentLocation() {
  const [location, setLocation] = useState<{
    coords: LocationCoords | null;
    accuracy: number | null;
    loading: boolean;
    error: string | null;
  }>({
    coords: null,
    accuracy: null,
    loading: false,
    error: null,
  });

  const getLocation = useCallback(async () => {
    setLocation(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await getCurrentLocation();
      setLocation({
        coords: result.coords,
        accuracy: result.accuracy,
        loading: false,
        error: null,
      });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown location error';
      setLocation(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      return null;
    }
  }, []);

  return {
    ...location,
    getLocation,
    hasLocation: !!location.coords,
    isAccurate: location.accuracy !== null && location.accuracy <= 100,
  };
}