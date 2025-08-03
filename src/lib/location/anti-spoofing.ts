import { detectSuspiciousMovement, verifyLocation, type LocationCoords } from './utils';

/**
 * Anti-spoofing detection with multiple validation layers
 * CRITICAL: Location spoofing cannot be prevented, only detected
 */

export interface AntiSpoofingResult {
  isValid: boolean;
  riskScore: number; // 0-100, higher means more suspicious
  flags: AntiSpoofingFlag[];
  details: Record<string, unknown>;
}

export enum AntiSpoofingFlag {
  GPS_ACCURACY_LOW = 'GPS_ACCURACY_LOW',
  OUTSIDE_RADIUS = 'OUTSIDE_RADIUS',
  IP_LOCATION_MISMATCH = 'IP_LOCATION_MISMATCH',
  SUSPICIOUS_MOVEMENT = 'SUSPICIOUS_MOVEMENT',
  RAPID_LOCATION_CHANGES = 'RAPID_LOCATION_CHANGES',
  IMPOSSIBLE_SPEED = 'IMPOSSIBLE_SPEED',
  CONSISTENT_PERFECT_ACCURACY = 'CONSISTENT_PERFECT_ACCURACY',
  LOCATION_CLUSTERING = 'LOCATION_CLUSTERING',
  TIME_PATTERN_ANOMALY = 'TIME_PATTERN_ANOMALY',
  DEVICE_INCONSISTENCY = 'DEVICE_INCONSISTENCY',
}

export interface LocationHistory {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  userAgent?: string;
  deviceId?: string;
}

export interface ValidationContext {
  branchLocation: LocationCoords;
  radiusMeters: number;
  employeeId: string;
  locationHistory: LocationHistory[];
  previousClockIns: LocationHistory[];
}

/**
 * Comprehensive anti-spoofing validation
 */
export async function validateLocationWithAntiSpoofing(
  currentLocation: LocationCoords,
  accuracy: number,
  context: ValidationContext
): Promise<AntiSpoofingResult> {
  const flags: AntiSpoofingFlag[] = [];
  const details: Record<string, unknown> = {};
  let riskScore = 0;

  // 1. Basic location verification
  const locationVerification = await verifyLocation(
    currentLocation,
    accuracy,
    context.branchLocation,
    context.radiusMeters
  );

  if (!locationVerification.verified) {
    switch (locationVerification.reason) {
      case 'GPS_ACCURACY_TOO_LOW':
        flags.push(AntiSpoofingFlag.GPS_ACCURACY_LOW);
        riskScore += 15;
        break;
      case 'OUTSIDE_LOCATION_RADIUS':
        flags.push(AntiSpoofingFlag.OUTSIDE_RADIUS);
        riskScore += 30;
        break;
      case 'IP_LOCATION_MISMATCH':
        flags.push(AntiSpoofingFlag.IP_LOCATION_MISMATCH);
        riskScore += 25;
        break;
    }
  }

  details.basicVerification = locationVerification;

  // 2. Movement analysis
  if (context.locationHistory.length > 0) {
    const movementAnalysis = analyzeMovementPatterns(currentLocation, accuracy, context.locationHistory);
    flags.push(...movementAnalysis.flags);
    riskScore += movementAnalysis.riskScore;
    details.movementAnalysis = movementAnalysis;
  }

  // 3. GPS accuracy pattern analysis
  const accuracyAnalysis = analyzeAccuracyPatterns(accuracy, context.locationHistory);
  flags.push(...accuracyAnalysis.flags);
  riskScore += accuracyAnalysis.riskScore;
  details.accuracyAnalysis = accuracyAnalysis;

  // 4. Historical location clustering
  if (context.previousClockIns.length > 0) {
    const clusteringAnalysis = analyzeLocationClustering(currentLocation, context.previousClockIns);
    flags.push(...clusteringAnalysis.flags);
    riskScore += clusteringAnalysis.riskScore;
    details.clusteringAnalysis = clusteringAnalysis;
  }

  // 5. Time pattern analysis
  const timeAnalysis = analyzeTimePatterns(context.locationHistory);
  flags.push(...timeAnalysis.flags);
  riskScore += timeAnalysis.riskScore;
  details.timeAnalysis = timeAnalysis;

  // 6. Device consistency check
  const deviceAnalysis = analyzeDeviceConsistency(context.locationHistory);
  flags.push(...deviceAnalysis.flags);
  riskScore += deviceAnalysis.riskScore;
  details.deviceAnalysis = deviceAnalysis;

  // Cap risk score at 100
  riskScore = Math.min(riskScore, 100);

  return {
    isValid: riskScore < 50, // Consider suspicious if risk score >= 50
    riskScore,
    flags,
    details,
  };
}

/**
 * Analyze movement patterns for suspicious activity
 */
function analyzeMovementPatterns(
  currentLocation: LocationCoords,
  accuracy: number,
  history: LocationHistory[]
): { flags: AntiSpoofingFlag[]; riskScore: number; details: Record<string, unknown> } {
  const flags: AntiSpoofingFlag[] = [];
  let riskScore = 0;
  const details: Record<string, unknown> = {};

  if (history.length === 0) {
    return { flags, riskScore, details };
  }

  const recentHistory = history.slice(-5); // Last 5 locations
  const rapidChanges = [];

  // Check for rapid location changes
  for (let i = 0; i < recentHistory.length; i++) {
    const prev = recentHistory[i];
    const current = {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      timestamp: Date.now(),
    };

    if (detectSuspiciousMovement(prev, current)) {
      rapidChanges.push({
        from: prev,
        to: current,
        speed: calculateSpeed(prev, current),
      });
    }
  }

  if (rapidChanges.length > 0) {
    flags.push(AntiSpoofingFlag.SUSPICIOUS_MOVEMENT);
    riskScore += Math.min(rapidChanges.length * 10, 30);
  }

  // Check for impossible speeds (teleportation)
  if (rapidChanges.some(change => change.speed > 200)) { // 200 km/h
    flags.push(AntiSpoofingFlag.IMPOSSIBLE_SPEED);
    riskScore += 40;
  }

  details.rapidChanges = rapidChanges;
  details.changeCount = rapidChanges.length;

  return { flags, riskScore, details };
}

/**
 * Analyze GPS accuracy patterns
 */
function analyzeAccuracyPatterns(
  currentAccuracy: number,
  history: LocationHistory[]
): { flags: AntiSpoofingFlag[]; riskScore: number; details: Record<string, unknown> } {
  const flags: AntiSpoofingFlag[] = [];
  let riskScore = 0;
  const details: Record<string, unknown> = {};

  if (history.length < 3) {
    return { flags, riskScore, details };
  }

  const recentAccuracies = [...history.slice(-10).map(h => h.accuracy), currentAccuracy];
  const avgAccuracy = recentAccuracies.reduce((sum, acc) => sum + acc, 0) / recentAccuracies.length;
  const variance = recentAccuracies.reduce((sum, acc) => sum + Math.pow(acc - avgAccuracy, 2), 0) / recentAccuracies.length;

  // Check for suspiciously consistent perfect accuracy (possible spoofing)
  const perfectAccuracyCount = recentAccuracies.filter(acc => acc <= 5).length; // <= 5m accuracy
  const perfectAccuracyRatio = perfectAccuracyCount / recentAccuracies.length;

  if (perfectAccuracyRatio > 0.8 && variance < 2) {
    flags.push(AntiSpoofingFlag.CONSISTENT_PERFECT_ACCURACY);
    riskScore += 20;
  }

  details.avgAccuracy = avgAccuracy;
  details.variance = variance;
  details.perfectAccuracyRatio = perfectAccuracyRatio;

  return { flags, riskScore, details };
}

/**
 * Analyze location clustering patterns
 */
function analyzeLocationClustering(
  currentLocation: LocationCoords,
  previousClockIns: LocationHistory[]
): { flags: AntiSpoofingFlag[]; riskScore: number; details: Record<string, unknown> } {
  const flags: AntiSpoofingFlag[] = [];
  let riskScore = 0;
  const details: Record<string, unknown> = {};

  if (previousClockIns.length < 5) {
    return { flags, riskScore, details };
  }

  // Check if all clock-ins are from exactly the same location (suspicious)
  const clusters = clusterLocations(previousClockIns, 10); // 10m clustering radius
  const largestCluster = clusters.reduce((max, cluster) => 
    cluster.length > max.length ? cluster : max, []);

  const clusteringRatio = largestCluster.length / previousClockIns.length;

  // If >90% of clock-ins are from the exact same spot, it's suspicious
  if (clusteringRatio > 0.9 && largestCluster.length > 10) {
    flags.push(AntiSpoofingFlag.LOCATION_CLUSTERING);
    riskScore += 25;
  }

  details.clusters = clusters.length;
  details.largestClusterSize = largestCluster.length;
  details.clusteringRatio = clusteringRatio;

  return { flags, riskScore, details };
}

/**
 * Analyze timing patterns for anomalies
 */
function analyzeTimePatterns(
  history: LocationHistory[]
): { flags: AntiSpoofingFlag[]; riskScore: number; details: Record<string, unknown> } {
  const flags: AntiSpoofingFlag[] = [];
  let riskScore = 0;
  const details: Record<string, unknown> = {};

  if (history.length < 5) {
    return { flags, riskScore, details };
  }

  // Check for suspiciously regular intervals (bot-like behavior)
  const intervals = [];
  for (let i = 1; i < history.length; i++) {
    intervals.push(history[i].timestamp - history[i - 1].timestamp);
  }

  const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const intervalVariance = intervals.reduce((sum, interval) => 
    sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;

  // Very consistent intervals might indicate automated/scripted behavior
  if (intervalVariance < avgInterval * 0.1 && intervals.length > 5) {
    flags.push(AntiSpoofingFlag.TIME_PATTERN_ANOMALY);
    riskScore += 15;
  }

  details.avgInterval = avgInterval;
  details.intervalVariance = intervalVariance;
  details.intervals = intervals;

  return { flags, riskScore, details };
}

/**
 * Analyze device consistency
 */
function analyzeDeviceConsistency(
  history: LocationHistory[]
): { flags: AntiSpoofingFlag[]; riskScore: number; details: Record<string, unknown> } {
  const flags: AntiSpoofingFlag[] = [];
  let riskScore = 0;
  const details: Record<string, unknown> = {};

  if (history.length < 3) {
    return { flags, riskScore, details };
  }

  // Check for device ID consistency
  const deviceIds = history.map(h => h.deviceId).filter(Boolean);
  const uniqueDeviceIds = [...new Set(deviceIds)];

  if (uniqueDeviceIds.length > 3) { // More than 3 different devices
    flags.push(AntiSpoofingFlag.DEVICE_INCONSISTENCY);
    riskScore += 20;
  }

  // Check for user agent consistency
  const userAgents = history.map(h => h.userAgent).filter(Boolean);
  const uniqueUserAgents = [...new Set(userAgents)];

  if (uniqueUserAgents.length > 2) { // More than 2 different user agents
    riskScore += 10;
  }

  details.uniqueDeviceIds = uniqueDeviceIds.length;
  details.uniqueUserAgents = uniqueUserAgents.length;

  return { flags, riskScore, details };
}

/**
 * Calculate speed between two locations in km/h
 */
function calculateSpeed(
  from: { latitude: number; longitude: number; timestamp: number },
  to: { latitude: number; longitude: number; timestamp: number }
): number {
  const distance = calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
  const timeHours = (to.timestamp - from.timestamp) / (1000 * 60 * 60);
  return distance / 1000 / timeHours; // km/h
}

/**
 * Calculate distance using Haversine formula (meters)
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Cluster locations by proximity
 */
function clusterLocations(locations: LocationHistory[], radiusMeters: number): LocationHistory[][] {
  const clusters: LocationHistory[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < locations.length; i++) {
    if (used.has(i)) continue;

    const cluster = [locations[i]];
    used.add(i);

    for (let j = i + 1; j < locations.length; j++) {
      if (used.has(j)) continue;

      const distance = calculateDistance(
        locations[i].latitude,
        locations[i].longitude,
        locations[j].latitude,
        locations[j].longitude
      );

      if (distance <= radiusMeters) {
        cluster.push(locations[j]);
        used.add(j);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Get human-readable description of anti-spoofing flags
 */
export function getAntiSpoofingFlagDescription(flag: AntiSpoofingFlag): string {
  switch (flag) {
    case AntiSpoofingFlag.GPS_ACCURACY_LOW:
      return 'GPS accuracy is below acceptable threshold';
    case AntiSpoofingFlag.OUTSIDE_RADIUS:
      return 'Location is outside the permitted work area';
    case AntiSpoofingFlag.IP_LOCATION_MISMATCH:
      return 'GPS location does not match approximate IP location';
    case AntiSpoofingFlag.SUSPICIOUS_MOVEMENT:
      return 'Detected unusually fast movement between locations';
    case AntiSpoofingFlag.RAPID_LOCATION_CHANGES:
      return 'Multiple rapid location changes detected';
    case AntiSpoofingFlag.IMPOSSIBLE_SPEED:
      return 'Movement speed exceeds physically possible limits';
    case AntiSpoofingFlag.CONSISTENT_PERFECT_ACCURACY:
      return 'GPS accuracy is suspiciously consistent and perfect';
    case AntiSpoofingFlag.LOCATION_CLUSTERING:
      return 'Majority of check-ins from identical location';
    case AntiSpoofingFlag.TIME_PATTERN_ANOMALY:
      return 'Check-in timing follows suspicious regular pattern';
    case AntiSpoofingFlag.DEVICE_INCONSISTENCY:
      return 'Multiple different devices used recently';
    default:
      return 'Unknown anti-spoofing flag';
  }
}

/**
 * Create location history entry
 */
export function createLocationHistoryEntry(
  location: LocationCoords,
  accuracy: number,
  userAgent?: string,
  deviceId?: string
): LocationHistory {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy,
    timestamp: Date.now(),
    userAgent,
    deviceId,
  };
}