import { LocationVerificationResult } from '@/types/schedule';

/**
 * Location verification utilities for GPS-based time tracking
 * CRITICAL: Location spoofing cannot be prevented, only detected
 */

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface LocationAccuracy {
  accuracy: number; // GPS accuracy in meters
  timestamp: number; // Timestamp when location was obtained
}

export interface IPLocationData {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  accuracy: number; // IP-based accuracy (much lower than GPS)
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // Distance in meters
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get user's current location using Geolocation API
 * Returns a Promise that resolves with location coordinates and accuracy
 */
export function getCurrentLocation(): Promise<{
  coords: LocationCoords;
  accuracy: number;
  timestamp: number;
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000, // 10 seconds timeout
      maximumAge: 30000, // Accept cached position up to 30 seconds old
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        let errorMessage = 'Unknown location error';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        reject(new Error(errorMessage));
      },
      options
    );
  });
}

/**
 * Verify if user location is within acceptable range of branch location
 * Implements multiple validation layers as recommended in PRP
 */
export async function verifyLocation(
  userLocation: LocationCoords,
  accuracy: number,
  branchLocation: LocationCoords,
  radiusMeters: number = 50
): Promise<LocationVerificationResult> {
  // GOTCHA: GPS accuracy can vary from 10m to 1000m+
  const accuracyThreshold = parseInt(process.env.LOCATION_ACCURACY_THRESHOLD || '100');
  
  if (accuracy > accuracyThreshold) {
    return {
      verified: false,
      reason: 'GPS_ACCURACY_TOO_LOW',
      accuracy,
    };
  }

  // Calculate distance from branch location
  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    branchLocation.latitude,
    branchLocation.longitude
  );

  // Check if within acceptable radius
  if (distance > radiusMeters) {
    return {
      verified: false,
      reason: 'OUTSIDE_LOCATION_RADIUS',
      distance,
      accuracy,
    };
  }

  // Additional validation: IP geolocation cross-check
  try {
    const ipLocation = await getIPGeolocation();
    if (ipLocation) {
      const ipDistance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        ipLocation.latitude,
        ipLocation.longitude
      );

      // GOTCHA: IP geolocation is imprecise, use wide threshold (10km)
      const ipThreshold = 10000; // 10km
      if (ipDistance > ipThreshold) {
        return {
          verified: false,
          reason: 'IP_LOCATION_MISMATCH',
          distance,
          accuracy,
        };
      }
    }
  } catch (error) {
    // IP geolocation check failed, but don't fail the entire verification
    console.warn('IP geolocation check failed:', error);
  }

  return {
    verified: true,
    distance,
    accuracy,
  };
}

/**
 * Get approximate location based on IP address
 * This is used as additional validation layer against GPS spoofing
 */
async function getIPGeolocation(): Promise<IPLocationData | null> {
  try {
    // Using a free IP geolocation service
    // In production, consider using a more reliable service
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error('IP geolocation service unavailable');
    }
    
    const data = await response.json();
    
    return {
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude),
      city: data.city,
      country: data.country_name,
      accuracy: 10000, // IP-based location accuracy is very low
    };
  } catch (error) {
    console.error('Failed to get IP geolocation:', error);
    return null;
  }
}

/**
 * Check if location appears to be moving too fast (possible spoofing)
 * This can help detect users who are rapidly changing locations
 */
export function detectSuspiciousMovement(
  previousLocation: LocationCoords & { timestamp: number },
  currentLocation: LocationCoords & { timestamp: number }
): boolean {
  const distance = calculateDistance(
    previousLocation.latitude,
    previousLocation.longitude,
    currentLocation.latitude,
    currentLocation.longitude
  );
  
  const timeDiff = (currentLocation.timestamp - previousLocation.timestamp) / 1000; // seconds
  const speedMps = distance / timeDiff; // meters per second
  const speedKmh = speedMps * 3.6; // kilometers per hour
  
  // Flag as suspicious if speed exceeds reasonable limits (e.g., 100 km/h)
  const maxReasonableSpeed = 100; // km/h
  
  return speedKmh > maxReasonableSpeed;
}

/**
 * Format location for display
 */
export function formatLocation(location: LocationCoords, accuracy?: number): string {
  const lat = location.latitude.toFixed(6);
  const lng = location.longitude.toFixed(6);
  const acc = accuracy ? ` (±${Math.round(accuracy)}m)` : '';
  
  return `${lat}, ${lng}${acc}`;
}

/**
 * Check if browser supports required location features
 */
export function isLocationSupported(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Request location permission from user
 */
export async function requestLocationPermission(): Promise<PermissionState> {
  if ('permissions' in navigator) {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    return permission.state;
  }
  
  // Fallback: try to get location to test permission
  try {
    await getCurrentLocation();
    return 'granted';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('denied')) {
      return 'denied';
    }
    return 'prompt';
  }
}

/**
 * Geolocation error types for better error handling
 */
export enum LocationError {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  POSITION_UNAVAILABLE = 'POSITION_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  ACCURACY_TOO_LOW = 'ACCURACY_TOO_LOW',
  OUTSIDE_RADIUS = 'OUTSIDE_RADIUS',
  IP_MISMATCH = 'IP_MISMATCH',
}

/**
 * Get human-readable error message for location errors
 */
export function getLocationErrorMessage(error: LocationError): string {
  switch (error) {
    case LocationError.PERMISSION_DENIED:
      return 'Location access denied. Please enable location services and try again.';
    case LocationError.POSITION_UNAVAILABLE:
      return 'Unable to determine your location. Please try again.';
    case LocationError.TIMEOUT:
      return 'Location request timed out. Please try again.';
    case LocationError.NOT_SUPPORTED:
      return 'Location services are not supported by your browser.';
    case LocationError.ACCURACY_TOO_LOW:
      return 'GPS accuracy is too low. Please move to an area with better signal.';
    case LocationError.OUTSIDE_RADIUS:
      return 'You are not within the required distance of the workplace.';
    case LocationError.IP_MISMATCH:
      return 'Location verification failed. Please contact your manager.';
    default:
      return 'An unknown location error occurred.';
  }
}